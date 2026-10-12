"""Prueba con una exportación sintética que imita el formato real de Samsung Health."""
import sys
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import samsung_health_export as she  # noqa: E402

FILES = {
    "com.samsung.shealth.step_daily_trend.20240310120000.csv": (
        "com.samsung.shealth.step_daily_trend,6315003,3\n"
        "binning_data,update_time,create_time,source_pkg_name,source_type,count,speed,distance,calorie,deviceuuid,pkg_name,datauuid,day_time\n"
        # source_type -2 = total combinado; 0 = teléfono (no debe sumarse)
        ",2024-03-09 23:00:00.000,2024-03-09 23:00:00.000,com.sec.android.app.shealth,-2,8500,1.2,6200.5,310.2,abc,com.sec.android.app.shealth,u1,1709942400000,\n"
        ",2024-03-09 23:00:00.000,2024-03-09 23:00:00.000,com.sec.android.app.shealth,0,7000,1.2,5000,250,abc,com.sec.android.app.shealth,u2,1709942400000,\n"
        ",2024-03-10 23:00:00.000,2024-03-10 23:00:00.000,com.sec.android.app.shealth,-2,10200,1.3,7400,400,abc,com.sec.android.app.shealth,u3,1710028800000,\n"
    ),
    "com.samsung.shealth.tracker.heart_rate.20240310120000.csv": (
        "com.samsung.health.heart_rate,6313009,3\n"
        "source,tag_id,com.samsung.health.heart_rate.create_sh_ver,com.samsung.health.heart_rate.heart_beat_count,"
        "com.samsung.health.heart_rate.start_time,com.samsung.health.heart_rate.custom,com.samsung.health.heart_rate.min,"
        "com.samsung.health.heart_rate.max,com.samsung.health.heart_rate.time_offset,com.samsung.health.heart_rate.end_time,"
        "com.samsung.health.heart_rate.heart_rate,com.samsung.health.heart_rate.comment,com.samsung.health.heart_rate.datauuid\n"
        "0,21313,6.20,1,2024-03-09 12:00:00.000,,60,70,UTC-0300,2024-03-09 12:00:00.000,65,,h1,\n"
        "0,21313,6.20,1,2024-03-09 14:30:00.000,,70,90,UTC-0300,2024-03-09 14:30:00.000,85,\"nota, con coma\",h2,\n"
        # 02:00 UTC del 10 = 23:00 local del 9 -> debe contar para el día 9
        "0,21313,6.20,1,2024-03-10 02:00:00.000,,50,60,UTC-0300,2024-03-10 02:00:00.000,55,,h3,\n"
    ),
    "com.samsung.shealth.sleep.20240310120000.csv": (
        "com.samsung.shealth.sleep,6312002,4\n"
        "original_efficiency,mental_recovery,start_time,end_time,time_offset,efficiency,sleep_score,datauuid\n"
        "90,50,2024-03-10 02:30:00.000,2024-03-10 10:00:00.000,UTC-0300,92,80,s1,\n"
    ),
    "com.samsung.health.weight.20240310120000.csv": (
        "com.samsung.health.weight,6313007,2\n"
        "start_time,weight,body_fat,time_offset,datauuid\n"
        "2024-03-10 11:00:00.000,82.4,22.1,UTC-0300,w1,\n"
    ),
    "com.samsung.shealth.exercise.20240310120000.csv": (
        "com.samsung.shealth.exercise,6312003,5\n"
        "com.samsung.health.exercise.start_time,com.samsung.health.exercise.duration,com.samsung.health.exercise.exercise_type,"
        "com.samsung.health.exercise.time_offset,com.samsung.health.exercise.datauuid\n"
        "2024-03-10 21:00:00.000,1800000,1001,UTC-0300,e1,\n"
    ),
    "com.samsung.shealth.stress.20240310120000.csv": (
        "com.samsung.shealth.stress,6312003,1\n"
        "start_time,end_time,score,time_offset,datauuid\n"
        "2024-03-10 13:00:00.000,2024-03-10 13:01:00.000,40,UTC-0300,x1,\n"
        "2024-03-10 15:00:00.000,2024-03-10 15:01:00.000,60,UTC-0300,x2,\n"
    ),
    "jsons/com.samsung.shealth.tracker.heart_rate/0/ignorar.csv": "no,es,una,tabla\n",
}


def build_export(root: Path) -> Path:
    export = root / "samsunghealth_usuario_20240310120000"
    for rel, text in FILES.items():
        f = export / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text, encoding="utf-8")
    return export


class SamsungHealthExportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.export = build_export(self.tmp)

    def test_tablas_y_columnas_limpias(self):
        tables = she.load_export(self.export)
        self.assertEqual(
            sorted(tables),
            ["exercise", "sleep", "step_daily_trend", "stress", "tracker.heart_rate", "weight"],
        )
        hr = tables["tracker.heart_rate"]
        self.assertIn("heart_rate", hr.columns)
        self.assertIn("start_time_local", hr.columns)
        self.assertEqual(hr["comment"].iloc[1], "nota, con coma")
        self.assertEqual(hr["heart_rate"].tolist(), [65, 85, 55])
        self.assertEqual(str(hr["start_time_local"].iloc[2]), "2024-03-09 23:00:00")

    def test_resumen_diario(self):
        out = self.tmp / "salida"
        she.run(self.export, out, excel=True)
        summary = she.daily_summary(she.load_export(self.export)).set_index("fecha")
        d9, d10 = date(2024, 3, 9), date(2024, 3, 10)
        # pasos: solo el total combinado (8500), no 8500 + 7000
        self.assertEqual(summary.loc[d9, "pasos"], 8500)
        self.assertEqual(summary.loc[d10, "pasos"], 10200)
        self.assertAlmostEqual(summary.loc[d9, "distancia_km"], 6.2, places=1)
        self.assertEqual(summary.loc[d9, "fc_min_lpm"], 55)
        self.assertEqual(summary.loc[d9, "fc_max_lpm"], 85)
        self.assertEqual(summary.loc[d10, "sueno_horas"], 7.5)
        self.assertEqual(summary.loc[d10, "peso_kg"], 82.4)
        self.assertEqual(summary.loc[d10, "ejercicio_min"], 30)
        self.assertEqual(summary.loc[d10, "estres_promedio"], 50)
        for f in ("catalogo.csv", "resumen_diario.csv", "SamsungHealth.xlsx", "tablas/tracker.heart_rate.csv"):
            self.assertTrue((out / f).exists(), f)

    def test_zip(self):
        zpath = self.tmp / "export.zip"
        with zipfile.ZipFile(zpath, "w") as zf:
            for f in self.export.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(self.tmp))
        tables = she.run(zpath, self.tmp / "salida_zip")
        self.assertIn("sleep", tables)


if __name__ == "__main__":
    unittest.main()
