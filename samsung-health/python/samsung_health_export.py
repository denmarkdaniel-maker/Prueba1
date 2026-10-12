"""
Convierte la exportación de Samsung Health ("Descargar datos personales") en tablas
limpias para Excel / Power BI.

Uso:
    python samsung_health_export.py <carpeta_o_zip_exportado> [carpeta_salida] [--excel]

Genera en la carpeta de salida (por defecto ./salida_samsung_health):
    tablas/<tipo>.csv      una tabla limpia por cada tipo de dato exportado
    catalogo.csv           qué tablas hay, cuántas filas y qué rango de fechas cubren
    resumen_diario.csv     pasos, sueño, frecuencia cardíaca, peso, ejercicio y estrés por día
    SamsungHealth.xlsx     (con --excel) resumen + catálogo + tablas que quepan en Excel
"""
from __future__ import annotations

import csv
import re
import sys
import tempfile
import zipfile
from pathlib import Path

import pandas as pd

EXCEL_MAX_ROWS = 1_048_575
_TS_SUFFIX = re.compile(r"\.\d{8,14}$")
_OFFSET = re.compile(r"UTC([+-])(\d{2}):?(\d{2})")


# --------------------------------------------------------------------------- lectura

def short_name(file: Path) -> str:
    """com.samsung.shealth.tracker.heart_rate.20240101120000.csv -> tracker.heart_rate"""
    name = _TS_SUFFIX.sub("", file.stem)
    for prefix in ("com.samsung.shealth.", "com.samsung.health.", "com.samsung."):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def clean_columns(columns: list[str], datatype: str) -> list[str]:
    """Quita el prefijo 'com.samsung.health.xxx.' de los encabezados y evita duplicados."""
    out: list[str] = []
    for col in columns:
        col = col.strip()
        if datatype and col.startswith(datatype + "."):
            col = col[len(datatype) + 1:]
        elif col.startswith("com.samsung."):
            col = col.rsplit(".", 1)[-1]
        base, n = col or "columna", 2
        while col in out or not col:
            col = f"{base}_{n}"
            n += 1
        out.append(col)
    return out


def read_samsung_csv(file: Path) -> tuple[str, pd.DataFrame]:
    """Lee un CSV de Samsung Health: línea 1 = metadatos, línea 2 = encabezados.

    Las filas de datos suelen traer una coma final de más; se recortan para que
    calcen con los encabezados.
    """
    with open(file, encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        meta = next(reader, [])
        header = next(reader, [])
        rows = list(reader)

    datatype = meta[0].strip() if meta else ""
    while header and not header[-1].strip():
        header.pop()
    width = len(header)
    fixed = []
    for row in rows:
        if not any(cell.strip() for cell in row):
            continue
        if len(row) > width:
            row = row[:width] if not any(c.strip() for c in row[width:]) else row[:width - 1] + [",".join(row[width - 1:])]
        elif len(row) < width:
            row = row + [""] * (width - len(row))
        fixed.append(row)

    df = pd.DataFrame(fixed, columns=clean_columns(header, datatype))
    return datatype, convert_types(df)


# --------------------------------------------------------------------------- tipos

def _offset_minutes(value) -> float:
    """'UTC-0300' -> -180"""
    m = _OFFSET.search(str(value)) if isinstance(value, str) else None
    if not m:
        return float("nan")
    sign = -1 if m.group(1) == "-" else 1
    return sign * (int(m.group(2)) * 60 + int(m.group(3)))


def _parse_time(series: pd.Series) -> pd.Series:
    """Fechas de Samsung: texto 'YYYY-MM-DD HH:MM:SS.fff' (UTC) o epoch en milisegundos."""
    s = series.replace("", pd.NA)
    numeric = pd.to_numeric(s, errors="coerce")
    if numeric.notna().sum() >= max(1, s.notna().sum() * 0.9):
        return pd.to_datetime(numeric, unit="ms", errors="coerce")
    return pd.to_datetime(s, errors="coerce", format="mixed")


def convert_types(df: pd.DataFrame) -> pd.DataFrame:
    """Números a número, *_time a fecha UTC + columna *_local según time_offset."""
    offset = df["time_offset"].map(_offset_minutes) if "time_offset" in df.columns else None

    for col in list(df.columns):
        if col == "day_time":
            df["fecha"] = _parse_time(df[col]).dt.normalize()
        elif col.endswith("_time") and col != "time_offset":
            utc = _parse_time(df[col])
            df[col] = utc
            if offset is not None and offset.notna().any():
                df[col + "_local"] = utc + pd.to_timedelta(offset.fillna(0), unit="m")
        else:
            as_num = pd.to_numeric(df[col].replace("", pd.NA), errors="coerce")
            non_empty = (df[col] != "").sum()
            if non_empty and as_num.notna().sum() == non_empty:
                df[col] = as_num
    return df


# --------------------------------------------------------------------------- resumen diario

def _local(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col + "_local"] if col + "_local" in df.columns else df[col]


def _find(tables: dict[str, pd.DataFrame], *suffixes: str) -> pd.DataFrame | None:
    for suffix in suffixes:
        for name, df in tables.items():
            if name == suffix or name.endswith("." + suffix):
                return df
    return None


def daily_summary(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    parts: list[pd.DataFrame] = []

    steps = _find(tables, "step_daily_trend")
    if steps is not None and {"fecha", "count"} <= set(steps.columns):
        # source_type = -2 es el total combinado de todos los dispositivos (sin duplicar teléfono + reloj)
        s = steps[steps["source_type"] == -2] if "source_type" in steps.columns and (steps["source_type"] == -2).any() else steps
        cols = {"count": "pasos", "distance": "distancia_km", "calorie": "calorias_actividad_kcal"}
        agg = s.groupby("fecha")[[c for c in cols if c in s.columns]].max().rename(columns=cols)
        if "distancia_km" in agg:
            agg["distancia_km"] = agg["distancia_km"] / 1000
        parts.append(agg)

    hr = _find(tables, "tracker.heart_rate", "heart_rate")
    if hr is not None and {"heart_rate", "start_time"} <= set(hr.columns):
        h = hr.assign(fecha=_local(hr, "start_time").dt.normalize())
        parts.append(h.groupby("fecha")["heart_rate"].agg(fc_promedio_lpm="mean", fc_min_lpm="min", fc_max_lpm="max"))

    sleep = _find(tables, "sleep")
    if sleep is not None and {"start_time", "end_time"} <= set(sleep.columns):
        # La noche se asigna al día en que despiertas
        sl = sleep.assign(
            fecha=_local(sleep, "end_time").dt.normalize(),
            sueno_horas=(sleep["end_time"] - sleep["start_time"]).dt.total_seconds() / 3600,
        )
        parts.append(sl.groupby("fecha")[["sueno_horas"]].sum())

    weight = _find(tables, "weight")
    if weight is not None and {"weight", "start_time"} <= set(weight.columns):
        w = weight.assign(fecha=_local(weight, "start_time").dt.normalize())
        parts.append(w.groupby("fecha")[["weight"]].mean().rename(columns={"weight": "peso_kg"}))

    exercise = _find(tables, "exercise")
    if exercise is not None and {"duration", "start_time"} <= set(exercise.columns):
        e = exercise.assign(
            fecha=_local(exercise, "start_time").dt.normalize(),
            ejercicio_min=exercise["duration"] / 60000,
        )
        parts.append(e.groupby("fecha").agg(ejercicio_min=("ejercicio_min", "sum"), sesiones_ejercicio=("ejercicio_min", "size")))

    stress = _find(tables, "stress")
    if stress is not None and {"score", "start_time"} <= set(stress.columns):
        st = stress.assign(fecha=_local(stress, "start_time").dt.normalize())
        parts.append(st.groupby("fecha")[["score"]].mean().rename(columns={"score": "estres_promedio"}))

    if not parts:
        return pd.DataFrame()
    out = pd.concat(parts, axis=1).sort_index()
    out.index = out.index.date
    out.index.name = "fecha"
    return out.round(2).reset_index()


# --------------------------------------------------------------------------- catálogo y salida

def date_range(df: pd.DataFrame) -> tuple[object, object]:
    for col in ("start_time_local", "start_time", "fecha", "create_time"):
        if col in df.columns and pd.api.types.is_datetime64_any_dtype(df[col]) and df[col].notna().any():
            return df[col].min(), df[col].max()
    return None, None


def safe_extract(zip_path: Path, target: Path) -> Path:
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.namelist():
            dest = (target / member).resolve()
            if not dest.is_relative_to(target.resolve()):
                raise ValueError(f"Ruta sospechosa dentro del zip: {member}")
        zf.extractall(target)
    return target


def load_export(source: Path) -> dict[str, pd.DataFrame]:
    tables: dict[str, pd.DataFrame] = {}
    for file in sorted(source.rglob("*.csv")):
        if {"jsons", "files"} & set(file.relative_to(source).parts[:-1]):
            continue
        name = short_name(file)
        try:
            _, df = read_samsung_csv(file)
        except Exception as exc:  # un archivo dañado no debe detener el resto
            print(f"  ! {file.name}: {exc}")
            continue
        if name in tables:
            df = pd.concat([tables[name], df], ignore_index=True)
        tables[name] = df
    return tables


def run(source: Path, out_dir: Path, excel: bool = False) -> dict[str, pd.DataFrame]:
    if source.suffix.lower() == ".zip":
        tmp = Path(tempfile.mkdtemp(prefix="shealth_"))
        source = safe_extract(source, tmp)

    tables = load_export(source)
    if not tables:
        raise SystemExit(f"No se encontraron CSV de Samsung Health en {source}")

    (out_dir / "tablas").mkdir(parents=True, exist_ok=True)
    catalog = []
    for name, df in tables.items():
        df.to_csv(out_dir / "tablas" / f"{name}.csv", index=False, encoding="utf-8-sig")
        first, last = date_range(df)
        catalog.append({"tabla": name, "filas": len(df), "columnas": df.shape[1], "desde": first, "hasta": last})
    catalog_df = pd.DataFrame(catalog).sort_values("filas", ascending=False)
    catalog_df.to_csv(out_dir / "catalogo.csv", index=False, encoding="utf-8-sig")

    summary = daily_summary(tables)
    summary.to_csv(out_dir / "resumen_diario.csv", index=False, encoding="utf-8-sig")

    if excel:
        with pd.ExcelWriter(out_dir / "SamsungHealth.xlsx", engine="openpyxl") as xw:
            summary.to_excel(xw, sheet_name="resumen_diario", index=False)
            catalog_df.to_excel(xw, sheet_name="catalogo", index=False)
            used = {"resumen_diario", "catalogo"}
            for name, df in tables.items():
                if len(df) > EXCEL_MAX_ROWS:
                    print(f"  · {name}: {len(df):,} filas, no cabe en Excel (usa el CSV o Power BI)")
                    continue
                sheet = re.sub(r"[\[\]:*?/\\]", "_", name)[:31]
                while sheet in used:
                    sheet = sheet[:29] + f"_{len(used)}"
                used.add(sheet)
                df.to_excel(xw, sheet_name=sheet, index=False)

    print(f"{len(tables)} tablas, {sum(len(d) for d in tables.values()):,} filas → {out_dir.resolve()}")
    print(f"Resumen diario: {len(summary)} días")
    return tables


def main(argv: list[str]) -> None:
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__)
        raise SystemExit(1)
    source = Path(args[0])
    out_dir = Path(args[1]) if len(args) > 1 else Path("salida_samsung_health")
    run(source, out_dir, excel="--excel" in argv)


if __name__ == "__main__":
    main(sys.argv[1:])
