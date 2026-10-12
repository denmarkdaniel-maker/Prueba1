// Power Query — resumen diario. Sirve para los dos orígenes:
//   * "salud_resumen_diario_*.csv" de la app Android (Health Connect)
//   * "resumen_diario.csv" del script Python (exportación de Samsung Health)
// Todas las columnas salvo "fecha" se tipan como número, así funciona aunque falten algunas.
let
    Ruta = "C:\SamsungHealth\resumen_diario.csv",
    Origen = Csv.Document(File.Contents(Ruta), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Encabezados = Table.PromoteHeaders(Origen, [PromoteAllScalars = true]),
    Metricas = List.RemoveItems(Table.ColumnNames(Encabezados), {"fecha"}),
    Tipos = Table.TransformColumnTypes(
        Encabezados,
        {{"fecha", type date}} & List.Transform(Metricas, each {_, type number}),
        "en-US"
    ),
    Anio = Table.AddColumn(Tipos, "año", each Date.Year([fecha]), Int64.Type),
    Mes = Table.AddColumn(Anio, "mes", each Date.StartOfMonth([fecha]), type date),
    DiaSemana = Table.AddColumn(Mes, "dia_semana", each Date.DayOfWeekName([fecha], "es-CL"), type text)
in
    DiaSemana
