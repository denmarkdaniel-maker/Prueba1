// Power Query (Power BI / Excel) — CSV "salud_registros_*.csv" generado por la app Android.
// Inicio > Transformar datos > Nueva consulta > Consulta en blanco > Editor avanzado > pegar.
// Cambia la ruta por la de tu archivo.
let
    Ruta = "C:\SamsungHealth\salud_registros.csv",
    Origen = Csv.Document(File.Contents(Ruta), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Encabezados = Table.PromoteHeaders(Origen, [PromoteAllScalars = true]),
    // Los números vienen con punto decimal: se convierten con cultura en-US
    Tipos = Table.TransformColumnTypes(
        Encabezados,
        {
            {"tipo", type text}, {"inicio_utc", type datetimezone}, {"fin_utc", type datetimezone},
            {"inicio_local", type datetime}, {"fin_local", type datetime}, {"valor", type number},
            {"unidad", type text}, {"detalle", type text}, {"app_origen", type text},
            {"dispositivo", type text}, {"id_registro", type text}
        },
        "en-US"
    ),
    Fecha = Table.AddColumn(Tipos, "fecha", each Date.From([inicio_local]), type date),
    Hora = Table.AddColumn(Fecha, "hora", each Time.Hour([inicio_local]), Int64.Type)
in
    Hora
