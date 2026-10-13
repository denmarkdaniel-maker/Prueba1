/* Base de datos de ejercicios con kettlebell (pesa rusa).
 * Script plano de navegador: define window.KB_EXERCISES y window.KB_CATEGORIES.
 * Cada `anim` corresponde a una clave de ANIMS.md.
 */
(function () {
  "use strict";

  window.KB_CATEGORIES = ["Balístico", "Fuerza", "Core", "Movilidad", "Carga", "Complejo"];

  window.KB_EXERCISES = [
    /* ---------- Fundamentales ---------- */
    {
      id: "swing-ruso",
      nombre: "Swing ruso",
      en: "Russian Kettlebell Swing",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 1,
      musculos: ["Glúteos", "Isquiotibiales", "Core", "Antebrazos"],
      anim: "swing_2h",
      double: false,
      unilateral: false,
      series: "5–10",
      reps: "10–15",
      descanso: 60,
      pesoInicial: 24,
      desc: "Bisagra de cadera explosiva con la pesa a dos manos hasta la altura del pecho. Es la base de todo el trabajo balístico y desarrolla potencia de cadera y resistencia.",
      cues: [
        "Lleva la pesa atrás, alta entre los muslos, como un pase de fútbol",
        "Extiende la cadera de golpe y aprieta glúteos arriba",
        "Termina en plancha de pie: rodillas firmes, abdomen apretado"
      ],
      errores: [
        "Sentadillar en vez de hacer bisagra de cadera",
        "Levantar la pesa con los brazos en lugar de la cadera"
      ]
    },
    {
      id: "peso-muerto",
      nombre: "Peso muerto",
      en: "Kettlebell Deadlift",
      cat: "Fuerza",
      patron: "Bisagra",
      nivel: 1,
      musculos: ["Glúteos", "Isquiotibiales", "Espalda baja", "Antebrazos"],
      anim: "deadlift",
      double: false,
      unilateral: false,
      series: "3–5",
      reps: "5–10",
      descanso: 90,
      pesoInicial: 32,
      desc: "Levantamiento de la pesa desde el suelo entre los pies con bisagra de cadera. Enseña el patrón base del swing y fortalece la cadena posterior.",
      cues: [
        "Pesa entre los arcos de los pies, empuja la cadera hacia atrás",
        "Espalda neutra y hombros encajados antes de tirar",
        "Empuja el suelo y termina con glúteos apretados"
      ],
      errores: [
        "Redondear la espalda baja al bajar a la pesa",
        "Hiperextender la columna al final del movimiento"
      ]
    },
    {
      id: "sentadilla-goblet",
      nombre: "Sentadilla goblet",
      en: "Goblet Squat",
      cat: "Fuerza",
      patron: "Sentadilla",
      nivel: 1,
      musculos: ["Cuádriceps", "Glúteos", "Aductores", "Core"],
      anim: "goblet_squat",
      double: false,
      unilateral: false,
      series: "3–5",
      reps: "8–12",
      descanso: 90,
      pesoInicial: 20,
      desc: "Sentadilla profunda sosteniendo la pesa por los cuernos frente al pecho. Enseña una sentadilla erguida y fortalece piernas y core.",
      cues: [
        "Codos pegados al cuerpo y pesa cerca del pecho",
        "Baja entre las caderas con el torso erguido",
        "Empuja con todo el pie y abre las rodillas"
      ],
      errores: [
        "Levantar los talones del suelo",
        "Dejar que las rodillas se vayan hacia adentro"
      ]
    },
    {
      id: "turkish-get-up",
      nombre: "Turkish get-up",
      en: "Turkish Get-Up",
      cat: "Core",
      patron: "Transición",
      nivel: 2,
      musculos: ["Hombros", "Core", "Glúteos", "Tríceps"],
      anim: "tgu",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "1–3 por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Pasar de acostado a de pie y volver con la pesa bloqueada sobre la cabeza. Desarrolla estabilidad de hombro, control del cuerpo y fuerza integral.",
      cues: [
        "Brazo bloqueado y vista en la pesa hasta quedar de rodillas",
        "Codo, mano y puente alto: un paso a la vez, sin apuro",
        "Muñeca neutra y hombro encajado durante todo el recorrido"
      ],
      errores: [
        "Doblar el codo o dejar que la pesa se vaya hacia la cara",
        "Apurar las transiciones y perder la posición"
      ]
    },

    /* ---------- Balístico ---------- */
    {
      id: "swing-una-mano",
      nombre: "Swing a una mano",
      en: "One-Arm Swing",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 2,
      musculos: ["Glúteos", "Isquiotibiales", "Oblicuos", "Antebrazos"],
      anim: "swing_1h",
      double: false,
      unilateral: true,
      series: "5–10",
      reps: "10 por lado",
      descanso: 60,
      pesoInicial: 20,
      desc: "Swing con una sola mano que obliga al tronco a resistir la rotación. Suma exigencia de agarre y es la antesala del clean y el snatch.",
      cues: [
        "Hombros cuadrados al frente, no dejes que la pesa te gire",
        "Hombro encajado: el brazo es una cuerda, no un motor",
        "Brazo libre activo al costado, imitando el trabajo"
      ],
      errores: [
        "Rotar el torso siguiendo la pesa",
        "Dejar que el hombro se despegue del cuerpo arriba"
      ]
    },
    {
      id: "swing-alterno",
      nombre: "Swing alterno",
      en: "Hand-to-Hand Swing",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 2,
      musculos: ["Glúteos", "Isquiotibiales", "Core", "Antebrazos"],
      anim: "swing_alt",
      double: false,
      unilateral: false,
      series: "5–8",
      reps: "10–20",
      descanso: 60,
      pesoInicial: 20,
      desc: "Swing a una mano cambiando de mano en el punto de flotación. Entrena coordinación, agarre y control de la pesa.",
      cues: [
        "Cambia de mano solo en el punto alto, cuando la pesa flota",
        "Mano libre lista y abierta antes del traspaso",
        "Mantén la misma bisagra potente en cada repetición"
      ],
      errores: [
        "Cambiar de mano cuando la pesa todavía sube con fuerza",
        "Perder la tensión del core en el traspaso"
      ]
    },
    {
      id: "swing-americano",
      nombre: "Swing americano",
      en: "American Swing",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 2,
      musculos: ["Glúteos", "Hombros", "Isquiotibiales", "Core"],
      anim: "swing_american",
      double: false,
      unilateral: false,
      series: "3–5",
      reps: "10–15",
      descanso: 75,
      pesoInicial: 16,
      desc: "Variante del swing en que la pesa sube hasta quedar sobre la cabeza. Aumenta el recorrido y la demanda cardiovascular, pero exige buena movilidad de hombros.",
      cues: [
        "La cadera manda; los brazos solo guían el final",
        "Termina con bíceps junto a las orejas y costillas abajo",
        "Usa una pesa más liviana que en el swing ruso"
      ],
      errores: [
        "Arquear la espalda baja para llegar arriba",
        "Tirar con los brazos y hombros en vez de la cadera"
      ]
    },
    {
      id: "swing-doble",
      nombre: "Swing doble",
      en: "Double Kettlebell Swing",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 3,
      musculos: ["Glúteos", "Isquiotibiales", "Espalda baja", "Antebrazos"],
      anim: "swing_1h",
      double: true,
      unilateral: false,
      series: "5–8",
      reps: "5–10",
      descanso: 90,
      pesoInicial: 16,
      desc: "Swing con una pesa en cada mano y postura algo más ancha. Permite mover mucha carga y desarrolla potencia de cadera de alto nivel.",
      cues: [
        "Pies algo más abiertos para que pasen ambas pesas",
        "Pesas altas en la carga, antebrazos contra los muslos",
        "Extiende la cadera explosivo y bloquea abdomen arriba"
      ],
      errores: [
        "Dejar caer las pesas lejos de la ingle",
        "Hiperextender la espalda al final del swing"
      ]
    },
    {
      id: "clean",
      nombre: "Clean",
      en: "Kettlebell Clean",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 2,
      musculos: ["Glúteos", "Isquiotibiales", "Dorsales", "Antebrazos"],
      anim: "clean",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "5–8 por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Llevar la pesa desde entre las piernas hasta la posición de rack con un impulso de cadera. Es la entrada al press, al jerk y a los complejos.",
      cues: [
        "Mantén la pesa cerca del cuerpo, como subiendo un cierre",
        "Mete la mano alrededor de la pesa, no la voltees",
        "Recibe en rack: codo pegado, muñeca recta, glúteos firmes"
      ],
      errores: [
        "Hacer un arco amplio y que la pesa golpee el antebrazo",
        "Recibir con la muñeca doblada hacia atrás"
      ]
    },
    {
      id: "clean-doble",
      nombre: "Clean doble",
      en: "Double Kettlebell Clean",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 3,
      musculos: ["Glúteos", "Isquiotibiales", "Dorsales", "Core"],
      anim: "clean",
      double: true,
      unilateral: false,
      series: "3–5",
      reps: "5",
      descanso: 90,
      pesoInicial: 16,
      desc: "Clean con dos pesas a la vez hasta el rack doble. Desarrolla potencia de cadera y prepara para el press y la sentadilla frontal doble.",
      cues: [
        "Postura algo más ancha y pesas juntas en la carga",
        "Codos cerrados y pesas pegadas al cuerpo al subir",
        "Rack doble firme: codos sobre la cadera, abdomen duro"
      ],
      errores: [
        "Abrir los codos y dejar que las pesas se separen",
        "Echar el torso hacia atrás para sostener el rack"
      ]
    },
    {
      id: "snatch",
      nombre: "Snatch",
      en: "Kettlebell Snatch",
      cat: "Balístico",
      patron: "Bisagra",
      nivel: 3,
      musculos: ["Glúteos", "Hombros", "Isquiotibiales", "Trapecio"],
      anim: "snatch",
      double: false,
      unilateral: true,
      series: "5–10",
      reps: "5–10 por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Llevar la pesa de entre las piernas a bloqueo sobre la cabeza en un solo movimiento. Es el rey de los balísticos: potencia, acondicionamiento y hombros.",
      cues: [
        "Tira el codo hacia atrás y luego golpea con la mano hacia arriba",
        "Mete la mano en la pesa para que no golpee el antebrazo",
        "Bloquea arriba con bíceps junto a la oreja y glúteos firmes"
      ],
      errores: [
        "Hacer un arco amplio y que la pesa caiga sobre la muñeca",
        "Inclinarse hacia atrás en el bloqueo"
      ]
    },
    {
      id: "jalon-alto-sumo",
      nombre: "Jalón alto sumo",
      en: "Sumo High Pull",
      cat: "Balístico",
      patron: "Tirón",
      nivel: 2,
      musculos: ["Glúteos", "Trapecio", "Hombros", "Cuádriceps"],
      anim: "sumo_high_pull",
      double: false,
      unilateral: false,
      series: "3–5",
      reps: "10–15",
      descanso: 60,
      pesoInicial: 20,
      desc: "Desde postura sumo, extensión explosiva de piernas y cadera llevando la pesa a la altura del pecho con los codos altos. Entrena potencia y espalda alta.",
      cues: [
        "Postura ancha con puntas afuera y pecho arriba",
        "Primero extiende piernas y cadera, después tira con los codos",
        "Codos por encima de las manos al final del tirón"
      ],
      errores: [
        "Tirar solo con los brazos sin impulso de piernas",
        "Redondear la espalda al bajar la pesa"
      ]
    },
    {
      id: "push-press",
      nombre: "Push press",
      en: "Kettlebell Push Press",
      cat: "Balístico",
      patron: "Empuje",
      nivel: 2,
      musculos: ["Hombros", "Tríceps", "Cuádriceps", "Core"],
      anim: "push_press",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "5–8 por lado",
      descanso: 75,
      pesoInicial: 16,
      desc: "Press desde el rack con un breve impulso de piernas. Permite mover más carga que el press estricto y desarrolla potencia de tren superior.",
      cues: [
        "Flexión corta de rodillas con el talón apoyado y torso recto",
        "Extiende piernas de golpe y prolonga el impulso con el brazo",
        "Bloquea arriba con el bíceps junto a la oreja"
      ],
      errores: [
        "Flexionar demasiado las rodillas, como sentadilla",
        "Inclinar el torso hacia atrás para empujar"
      ]
    },
    {
      id: "jerk",
      nombre: "Jerk",
      en: "Kettlebell Jerk",
      cat: "Balístico",
      patron: "Empuje",
      nivel: 3,
      musculos: ["Hombros", "Cuádriceps", "Tríceps", "Pantorrillas"],
      anim: "jerk",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "5–10 por lado",
      descanso: 75,
      pesoInicial: 16,
      desc: "Envión desde el rack con doble flexión de rodillas: impulso y recepción con brazo bloqueado. Movimiento clave del Girevoy Sport.",
      cues: [
        "Primera flexión corta y explosión con piernas y talones",
        "Métete bajo la pesa con la segunda flexión y brazo bloqueado",
        "Párate completo antes de bajar la pesa al rack"
      ],
      errores: [
        "Empujar con el brazo en lugar de usar las piernas",
        "Recibir con el codo doblado"
      ]
    },

    /* ---------- Fuerza ---------- */
    {
      id: "peso-muerto-una-pierna",
      nombre: "Peso muerto a una pierna",
      en: "Single-Leg Deadlift",
      cat: "Fuerza",
      patron: "Bisagra",
      nivel: 2,
      musculos: ["Glúteos", "Isquiotibiales", "Core", "Aductores"],
      anim: "sl_deadlift",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "6–8 por lado",
      descanso: 60,
      pesoInicial: 20,
      desc: "Bisagra de cadera sobre una pierna con la pesa en la mano contraria. Fortalece glúteos e isquiotibiales y mejora el equilibrio.",
      cues: [
        "Cadera cuadrada al suelo; la pierna libre sube en línea con la espalda",
        "Rodilla de apoyo levemente flexionada y firme",
        "Sube empujando el suelo y apretando el glúteo de apoyo"
      ],
      errores: [
        "Abrir la cadera y rotar el torso hacia afuera",
        "Redondear la espalda para alcanzar el suelo"
      ]
    },
    {
      id: "sentadilla-frontal",
      nombre: "Sentadilla frontal",
      en: "Kettlebell Front Squat",
      cat: "Fuerza",
      patron: "Sentadilla",
      nivel: 2,
      musculos: ["Cuádriceps", "Glúteos", "Oblicuos", "Core"],
      anim: "front_squat",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "5–8 por lado",
      descanso: 90,
      pesoInicial: 20,
      desc: "Sentadilla con una pesa en posición de rack. La carga asimétrica exige al core resistir la inclinación lateral.",
      cues: [
        "Rack firme: codo pegado a las costillas y muñeca recta",
        "Baja tirando de ti mismo hacia abajo con los flexores de cadera",
        "Sube con el pecho alto, sin inclinarte hacia la pesa"
      ],
      errores: [
        "Separar el codo del cuerpo y perder el rack",
        "Inclinar el torso hacia el lado de la pesa"
      ]
    },
    {
      id: "sentadilla-frontal-doble",
      nombre: "Sentadilla frontal doble",
      en: "Double Kettlebell Front Squat",
      cat: "Fuerza",
      patron: "Sentadilla",
      nivel: 3,
      musculos: ["Cuádriceps", "Glúteos", "Core", "Espalda alta"],
      anim: "front_squat",
      double: true,
      unilateral: false,
      series: "3–5",
      reps: "3–6",
      descanso: 120,
      pesoInicial: 16,
      desc: "Sentadilla con dos pesas en rack. Es uno de los mejores ejercicios de fuerza de piernas con kettlebell por la carga que permite.",
      cues: [
        "Rack doble con codos juntos y apoyados en el tronco",
        "Respira y aprieta el abdomen antes de bajar",
        "Baja hasta romper el paralelo manteniendo el torso erguido"
      ],
      errores: [
        "Dejar caer los codos y redondear la espalda alta",
        "Soltar la tensión del abdomen en la parte baja"
      ]
    },
    {
      id: "press-militar",
      nombre: "Press militar",
      en: "Kettlebell Military Press",
      cat: "Fuerza",
      patron: "Empuje",
      nivel: 1,
      musculos: ["Hombros", "Tríceps", "Core", "Trapecio"],
      anim: "press",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "5 por lado",
      descanso: 75,
      pesoInicial: 16,
      desc: "Press estricto de pie desde el rack hasta bloqueo sobre la cabeza. Construye fuerza de hombros y estabilidad de todo el cuerpo.",
      cues: [
        "Aprieta glúteos, abdomen y puño antes de empujar",
        "Antebrazo vertical durante todo el recorrido",
        "Bloquea arriba con el bíceps junto a la oreja"
      ],
      errores: [
        "Arquear la espalda para terminar el press",
        "Separar el codo hacia afuera al inicio del empuje"
      ]
    },
    {
      id: "press-doble",
      nombre: "Press doble",
      en: "Double Kettlebell Press",
      cat: "Fuerza",
      patron: "Empuje",
      nivel: 3,
      musculos: ["Hombros", "Tríceps", "Core", "Trapecio"],
      anim: "press",
      double: true,
      unilateral: false,
      series: "3–5",
      reps: "3–5",
      descanso: 120,
      pesoInicial: 16,
      desc: "Press militar con una pesa en cada mano a la vez. Exige más tensión de core porque no hay brazo libre para compensar.",
      cues: [
        "Rack doble firme y glúteos apretados antes de empujar",
        "Empuja ambas pesas a la par, cerca de la cara",
        "Costillas abajo: no arquees la espalda arriba"
      ],
      errores: [
        "Inclinar el torso hacia atrás para terminar",
        "Dejar que un brazo se adelante al otro"
      ]
    },
    {
      id: "press-fondo-arriba",
      nombre: "Press con fondo arriba",
      en: "Bottoms-Up Press",
      cat: "Fuerza",
      patron: "Empuje",
      nivel: 2,
      musculos: ["Hombros", "Antebrazos", "Tríceps", "Core"],
      anim: "press",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "3–5 por lado",
      descanso: 60,
      pesoInicial: 12,
      desc: "Press con la pesa invertida, base hacia arriba. Obliga a un agarre fuerte y a una trayectoria perfecta, ideal para hombros sanos.",
      cues: [
        "Aprieta el mango con fuerza para mantener la pesa vertical",
        "Antebrazo vertical y muñeca recta bajo la pesa",
        "Sube lento y controlado, sin perder la alineación"
      ],
      errores: [
        "Agarrar flojo y dejar que la pesa se voltee",
        "Usar una pesa demasiado pesada para controlar"
      ]
    },
    {
      id: "remo-inclinado",
      nombre: "Remo inclinado",
      en: "Bent-Over Row",
      cat: "Fuerza",
      patron: "Tirón",
      nivel: 1,
      musculos: ["Dorsales", "Bíceps", "Trapecio", "Espalda baja"],
      anim: "bent_row",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "8–10 por lado",
      descanso: 60,
      pesoInicial: 24,
      desc: "Remo a una mano con el torso inclinado en bisagra. Fortalece dorsales y espalda alta y equilibra el trabajo de empuje.",
      cues: [
        "Espalda plana y cadera atrás antes de tirar",
        "Tira el codo hacia la cadera, no hacia el techo",
        "Hombro abajo y lejos de la oreja al final"
      ],
      errores: [
        "Rotar el torso para subir la pesa",
        "Encoger el hombro hacia la oreja"
      ]
    },
    {
      id: "press-de-piso",
      nombre: "Press de piso",
      en: "Floor Press",
      cat: "Fuerza",
      patron: "Empuje",
      nivel: 1,
      musculos: ["Pecho", "Tríceps", "Hombros", "Core"],
      anim: "floor_press",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "6–10 por lado",
      descanso: 60,
      pesoInicial: 20,
      desc: "Press acostado en el suelo con la pesa en una mano. Fortalece pecho y tríceps con un rango seguro para el hombro.",
      cues: [
        "Codo a unos 45 grados del cuerpo, apoyado en el suelo",
        "Muñeca recta y pesa sobre el antebrazo",
        "Empuja hasta bloquear el codo con el hombro encajado"
      ],
      errores: [
        "Rebotar el codo contra el suelo",
        "Doblar la muñeca hacia atrás por el peso"
      ]
    },
    {
      id: "zancada-atras",
      nombre: "Zancada atrás",
      en: "Reverse Lunge",
      cat: "Fuerza",
      patron: "Zancada",
      nivel: 1,
      musculos: ["Cuádriceps", "Glúteos", "Aductores", "Core"],
      anim: "reverse_lunge",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "6–10 por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Paso hacia atrás bajando la rodilla cerca del suelo con la pesa en una mano. Fortalece piernas y glúteos y protege más la rodilla que la zancada adelante.",
      cues: [
        "Da un paso largo atrás y baja en vertical",
        "Rodilla trasera cerca del suelo sin golpearla",
        "Empuja con el talón de adelante para volver"
      ],
      errores: [
        "Dejar que la rodilla de adelante colapse hacia adentro",
        "Inclinar el torso hacia el lado de la pesa"
      ]
    },
    {
      id: "zancada-lateral",
      nombre: "Zancada lateral",
      en: "Lateral Lunge",
      cat: "Fuerza",
      patron: "Zancada",
      nivel: 2,
      musculos: ["Aductores", "Glúteos", "Cuádriceps", "Core"],
      anim: "lateral_lunge",
      double: false,
      unilateral: true,
      series: "3",
      reps: "6–8 por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Paso amplio hacia el costado con la pesa en goblet, bajando sobre una pierna. Trabaja piernas en el plano lateral y aductores.",
      cues: [
        "Paso amplio al lado y cadera atrás sobre la pierna que flexiona",
        "Pierna estirada firme y pie apoyado completo",
        "Empuja con fuerza para volver al centro"
      ],
      errores: [
        "Levantar el talón de la pierna que flexiona",
        "Redondear la espalda al bajar"
      ]
    },
    {
      id: "puente-gluteos",
      nombre: "Puente de glúteos",
      en: "Kettlebell Glute Bridge",
      cat: "Fuerza",
      patron: "Bisagra",
      nivel: 1,
      musculos: ["Glúteos", "Isquiotibiales", "Core"],
      anim: "glute_bridge",
      double: false,
      unilateral: false,
      series: "3–4",
      reps: "10–15",
      descanso: 45,
      pesoInicial: 32,
      desc: "Elevación de cadera desde el suelo con la pesa apoyada sobre la pelvis. Activa y fortalece los glúteos y complementa el swing.",
      cues: [
        "Pies firmes y talones cerca de los glúteos",
        "Sube la cadera apretando glúteos, no arqueando la espalda",
        "Sostén un segundo arriba y baja controlado"
      ],
      errores: [
        "Empujar con la espalda baja en vez de los glúteos",
        "Separar las rodillas hacia afuera sin control"
      ]
    },

    /* ---------- Core ---------- */
    {
      id: "medio-get-up",
      nombre: "Medio get-up",
      en: "Half Turkish Get-Up",
      cat: "Core",
      patron: "Transición",
      nivel: 1,
      musculos: ["Core", "Hombros", "Oblicuos", "Tríceps"],
      anim: "tgu",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "3 por lado",
      descanso: 45,
      pesoInicial: 16,
      desc: "Primera mitad del Turkish get-up: de acostado hasta apoyarse en la mano y volver. Enseña las transiciones iniciales y fortalece core y hombro.",
      cues: [
        "Rueda al codo empujando con el talón de la pierna flexionada",
        "Pasa del codo a la mano con el pecho abierto",
        "Brazo de la pesa vertical y bloqueado todo el tiempo"
      ],
      errores: [
        "Encogerse como abdominal en vez de rodar al codo",
        "Perder la verticalidad del brazo de la pesa"
      ]
    },
    {
      id: "molino",
      nombre: "Molino",
      en: "Kettlebell Windmill",
      cat: "Core",
      patron: "Bisagra",
      nivel: 2,
      musculos: ["Oblicuos", "Hombros", "Isquiotibiales", "Glúteos"],
      anim: "windmill",
      double: false,
      unilateral: true,
      series: "3",
      reps: "3–5 por lado",
      descanso: 60,
      pesoInicial: 12,
      desc: "Con la pesa bloqueada arriba, bisagra lateral llevando la mano libre al suelo. Desarrolla estabilidad de hombro, oblicuos y movilidad de cadera.",
      cues: [
        "Pies girados lejos de la pesa y cadera empujada hacia el brazo arriba",
        "Mira la pesa y mantén el brazo vertical",
        "Baja deslizando la mano libre por la pierna"
      ],
      errores: [
        "Doblar la rodilla de la pierna cargada",
        "Dejar que el brazo de la pesa se incline"
      ]
    },
    {
      id: "giro-ruso",
      nombre: "Giro ruso",
      en: "Russian Twist",
      cat: "Core",
      patron: "Rotación",
      nivel: 1,
      musculos: ["Oblicuos", "Core", "Hombros"],
      anim: "russian_twist",
      double: false,
      unilateral: false,
      series: "3",
      reps: "10–20",
      descanso: 45,
      pesoInicial: 12,
      desc: "Sentado e inclinado atrás, rotación del tronco llevando la pesa de lado a lado. Fortalece los oblicuos y el control rotacional.",
      cues: [
        "Pecho alto y espalda larga, inclinado unos 45 grados",
        "Gira desde las costillas, no solo con los brazos",
        "Toca el suelo con suavidad a cada lado"
      ],
      errores: [
        "Redondear la espalda baja",
        "Mover solo los brazos sin rotar el tronco"
      ]
    },
    {
      id: "abdominal-con-pesa",
      nombre: "Abdominal con pesa",
      en: "Kettlebell Sit-Up",
      cat: "Core",
      patron: "Transición",
      nivel: 1,
      musculos: ["Core", "Oblicuos", "Flexores de cadera"],
      anim: "situp",
      double: false,
      unilateral: false,
      series: "3",
      reps: "8–15",
      descanso: 45,
      pesoInicial: 12,
      desc: "Abdominal completo sosteniendo la pesa contra el pecho. Fortalece la musculatura anterior del tronco.",
      cues: [
        "Pesa pegada al pecho con ambas manos",
        "Sube vértebra a vértebra y baja controlado",
        "Exhala al subir y mantén los pies apoyados"
      ],
      errores: [
        "Tirar del cuello o lanzarse con impulso",
        "Dejarse caer sin control en la bajada"
      ]
    },
    {
      id: "abdominal-turco",
      nombre: "Abdominal turco",
      en: "Turkish Sit-Up",
      cat: "Core",
      patron: "Transición",
      nivel: 2,
      musculos: ["Core", "Hombros", "Oblicuos", "Tríceps"],
      anim: "situp",
      double: false,
      unilateral: true,
      series: "3",
      reps: "5 por lado",
      descanso: 45,
      pesoInicial: 12,
      desc: "Abdominal con la pesa bloqueada arriba en una mano durante todo el movimiento. Combina fuerza de core con estabilidad de hombro.",
      cues: [
        "Brazo bloqueado y vertical, mirando la pesa",
        "Sube sin perder la verticalidad del brazo",
        "Baja lento, controlando cada vértebra"
      ],
      errores: [
        "Dejar que la pesa se vaya hacia adelante",
        "Doblar el codo al subir"
      ]
    },
    {
      id: "remo-renegado",
      nombre: "Remo renegado",
      en: "Renegade Row",
      cat: "Core",
      patron: "Tirón",
      nivel: 2,
      musculos: ["Core", "Dorsales", "Oblicuos", "Hombros"],
      anim: "renegade_row",
      double: false,
      unilateral: false,
      series: "3–4",
      reps: "5–8 por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "En plancha sobre dos pesas, remo alternado sin rotar el cuerpo. Trabaja la estabilidad antirrotacional y la espalda.",
      cues: [
        "Pies separados y glúteos apretados en plancha firme",
        "Empuja fuerte la pesa de apoyo contra el suelo",
        "Rema hacia la cadera sin girar la pelvis"
      ],
      errores: [
        "Rotar la cadera al subir la pesa",
        "Dejar caer la cadera y perder la plancha"
      ]
    },
    {
      id: "peso-muerto-maleta",
      nombre: "Peso muerto maleta",
      en: "Suitcase Deadlift",
      cat: "Core",
      patron: "Bisagra",
      nivel: 1,
      musculos: ["Glúteos", "Oblicuos", "Cuádriceps", "Antebrazos"],
      anim: "suitcase_deadlift",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "5–8 por lado",
      descanso: 60,
      pesoInicial: 32,
      desc: "Peso muerto con la pesa al costado de un pie. La carga lateral obliga al core a evitar la inclinación del tronco.",
      cues: [
        "Pesa al lado del pie, mango alineado con el cuerpo",
        "Hombros nivelados durante todo el levantamiento",
        "Empuja el suelo y termina con glúteos apretados"
      ],
      errores: [
        "Inclinarse hacia el lado de la pesa",
        "Redondear la espalda para alcanzar el mango"
      ]
    },

    {
      id: "dead-bug-pullover",
      nombre: "Dead bug con pullover",
      en: "Dead Bug Pullover",
      cat: "Core",
      patron: "Tirón",
      nivel: 1,
      musculos: ["Core", "Dorsales", "Oblicuos"],
      anim: "pullover",
      double: false,
      unilateral: false,
      series: "3",
      reps: "6–10",
      descanso: 45,
      pesoInicial: 12,
      desc: "Acostado con rodillas a 90 grados, llevar la pesa atrás de la cabeza mientras se estiran las piernas. Entrena el core para resistir la extensión lumbar.",
      cues: [
        "Espalda baja pegada al suelo durante todo el movimiento",
        "Exhala largo mientras la pesa va atrás y las piernas se estiran",
        "Baja solo hasta donde mantengas las costillas abajo"
      ],
      errores: [
        "Despegar la espalda baja del suelo",
        "Mover rápido y perder el control de la pesa"
      ]
    },

    /* ---------- Movilidad ---------- */
    {
      id: "halo",
      nombre: "Halo",
      en: "Kettlebell Halo",
      cat: "Movilidad",
      patron: "Rotación",
      nivel: 1,
      musculos: ["Hombros", "Trapecio", "Core"],
      anim: "halo",
      double: false,
      unilateral: false,
      series: "2–3",
      reps: "5 por dirección",
      descanso: 30,
      pesoInicial: 12,
      desc: "Pasar la pesa alrededor de la cabeza sujetándola por los cuernos. Moviliza hombros y espalda alta y activa el core.",
      cues: [
        "Pesa invertida, sujeta por los cuernos y cerca de la cabeza",
        "Rodea la cabeza rozando la nuca",
        "Glúteos y abdomen apretados: el torso no se mueve"
      ],
      errores: [
        "Arquear la espalda al pasar la pesa por detrás",
        "Hacer círculos muy amplios y lejos de la cabeza"
      ]
    },
    {
      id: "alrededor-del-mundo",
      nombre: "Alrededor del mundo",
      en: "Around the World",
      cat: "Movilidad",
      patron: "Rotación",
      nivel: 1,
      musculos: ["Core", "Antebrazos", "Oblicuos", "Hombros"],
      anim: "around_world",
      double: false,
      unilateral: false,
      series: "2–3",
      reps: "10 por dirección",
      descanso: 30,
      pesoInicial: 16,
      desc: "Pasar la pesa de mano en mano alrededor de la cintura. Buen calentamiento para agarre, hombros y estabilidad del tronco.",
      cues: [
        "Cadera quieta: solo se mueven brazos y pesa",
        "Cambia de mano con firmeza delante y detrás",
        "Mantén el abdomen apretado y el pecho alto"
      ],
      errores: [
        "Mover la cadera siguiendo la pesa",
        "Soltar la pesa antes de que la otra mano la tome"
      ]
    },
    {
      id: "figura-8",
      nombre: "Figura 8",
      en: "Figure 8",
      cat: "Movilidad",
      patron: "Rotación",
      nivel: 1,
      musculos: ["Glúteos", "Isquiotibiales", "Core", "Antebrazos"],
      anim: "figure8",
      double: false,
      unilateral: false,
      series: "2–3",
      reps: "10–20",
      descanso: 30,
      pesoInicial: 16,
      desc: "En posición de bisagra, pasar la pesa entre las piernas dibujando un ocho. Calienta la cadena posterior y mejora coordinación y agarre.",
      cues: [
        "Mantén la bisagra: cadera atrás y espalda plana",
        "Pasa la pesa de adelante hacia atrás entre las piernas",
        "Mirada al frente y rodillas levemente flexionadas"
      ],
      errores: [
        "Redondear la espalda baja para alcanzar la pesa",
        "Pararse entre repeticiones y perder la bisagra"
      ]
    },
    {
      id: "sentadilla-cosaca",
      nombre: "Sentadilla cosaca",
      en: "Cossack Squat",
      cat: "Movilidad",
      patron: "Sentadilla",
      nivel: 2,
      musculos: ["Aductores", "Glúteos", "Cuádriceps", "Core"],
      anim: "lateral_lunge",
      double: false,
      unilateral: false,
      series: "2–3",
      reps: "5 por lado",
      descanso: 45,
      pesoInicial: 12,
      desc: "Sentadilla profunda sobre una pierna con la otra estirada al costado y la pesa en goblet. Mejora la movilidad de cadera y aductores.",
      cues: [
        "Postura muy ancha y pesa en goblet como contrapeso",
        "Baja profundo sobre una pierna con el talón apoyado",
        "Pierna estirada con la punta del pie hacia arriba"
      ],
      errores: [
        "Levantar el talón de la pierna flexionada",
        "Colapsar el pecho hacia adelante"
      ]
    },
    {
      id: "sentadilla-goblet-apertura",
      nombre: "Goblet con apertura",
      en: "Prying Goblet Squat",
      cat: "Movilidad",
      patron: "Sentadilla",
      nivel: 1,
      musculos: ["Aductores", "Glúteos", "Cuádriceps"],
      anim: "goblet_squat",
      double: false,
      unilateral: false,
      series: "2",
      reps: "3–5 (30–60 s abajo)",
      descanso: 30,
      pesoInicial: 16,
      desc: "Sentadilla goblet con pausa larga abajo, usando los codos para abrir las rodillas. Abre las caderas y prepara la sentadilla profunda.",
      cues: [
        "Quédate abajo con los codos por dentro de las rodillas",
        "Empuja las rodillas hacia afuera y balancea la cadera",
        "Respira lento y relaja la cadera en cada exhalación"
      ],
      errores: [
        "Levantar los talones en la posición baja",
        "Redondear la espalda al quedarse abajo"
      ]
    },
    {
      id: "pullover",
      nombre: "Pullover",
      en: "Kettlebell Pullover",
      cat: "Movilidad",
      patron: "Tirón",
      nivel: 1,
      musculos: ["Dorsales", "Pecho", "Core", "Tríceps"],
      anim: "pullover",
      double: false,
      unilateral: false,
      series: "2–3",
      reps: "8–12",
      descanso: 45,
      pesoInicial: 12,
      desc: "Acostado, llevar la pesa por los cuernos desde el pecho hasta detrás de la cabeza y volver. Moviliza hombros y espalda alta y estira los dorsales.",
      cues: [
        "Costillas abajo y espalda baja pegada al suelo",
        "Codos levemente flexionados y fijos",
        "Baja hasta donde controles sin arquear la espalda"
      ],
      errores: [
        "Arquear la espalda baja al llevar la pesa atrás",
        "Usar una pesa tan pesada que fuerce el hombro"
      ]
    },

    /* ---------- Carga ---------- */
    {
      id: "paseo-granjero",
      nombre: "Paseo del granjero",
      en: "Farmer's Carry",
      cat: "Carga",
      patron: "Carga",
      nivel: 1,
      musculos: ["Antebrazos", "Trapecio", "Core", "Glúteos"],
      anim: "farmer_carry",
      double: true,
      unilateral: false,
      series: "3–5",
      reps: "30–40 m",
      descanso: 60,
      pesoInicial: 24,
      desc: "Caminata con una pesa pesada en cada mano a los costados. Fortalece el agarre, la espalda alta y el core.",
      cues: [
        "Párate alto, hombros abajo y atrás",
        "Aprieta los mangos con fuerza",
        "Pasos cortos y controlados, mirada al frente"
      ],
      errores: [
        "Encoger los hombros hacia las orejas",
        "Dejar que las pesas golpeen las piernas al caminar"
      ]
    },
    {
      id: "paseo-maleta",
      nombre: "Paseo maleta",
      en: "Suitcase Carry",
      cat: "Carga",
      patron: "Carga",
      nivel: 1,
      musculos: ["Oblicuos", "Antebrazos", "Core", "Trapecio"],
      anim: "farmer_carry",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "20–30 m por lado",
      descanso: 60,
      pesoInicial: 28,
      desc: "Caminata con una sola pesa al costado, como una maleta. El core trabaja para evitar la inclinación lateral.",
      cues: [
        "Hombros nivelados: no te inclines hacia la pesa",
        "Brazo libre activo y puño apretado",
        "Camina erguido con el abdomen firme"
      ],
      errores: [
        "Inclinar el torso hacia el lado de la pesa",
        "Alejar la pesa del cuerpo"
      ]
    },
    {
      id: "caminata-mesero",
      nombre: "Caminata del mesero",
      en: "Waiter's Carry",
      cat: "Carga",
      patron: "Carga",
      nivel: 2,
      musculos: ["Hombros", "Core", "Trapecio", "Tríceps"],
      anim: "overhead_carry",
      double: false,
      unilateral: true,
      series: "3",
      reps: "20–30 m por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Caminata con la pesa bloqueada sobre la cabeza. Desarrolla estabilidad de hombro y control postural.",
      cues: [
        "Brazo bloqueado con el bíceps junto a la oreja",
        "Costillas abajo y glúteos firmes",
        "Camina lento sin dejar que la pesa se mueva"
      ],
      errores: [
        "Arquear la espalda baja para sostener la pesa",
        "Dejar que el brazo se vaya hacia adelante"
      ]
    },
    {
      id: "caminata-mesero-doble",
      nombre: "Caminata del mesero doble",
      en: "Double Overhead Carry",
      cat: "Carga",
      patron: "Carga",
      nivel: 3,
      musculos: ["Hombros", "Core", "Trapecio", "Tríceps"],
      anim: "overhead_carry",
      double: true,
      unilateral: false,
      series: "3",
      reps: "20–30 m",
      descanso: 90,
      pesoInicial: 12,
      desc: "Caminata con dos pesas bloqueadas sobre la cabeza. Exige gran movilidad y estabilidad de hombros y un core muy firme.",
      cues: [
        "Ambos brazos bloqueados y verticales",
        "Costillas abajo: no arquees para compensar",
        "Pasos cortos y respiración controlada"
      ],
      errores: [
        "Arquear la espalda baja por falta de movilidad",
        "Doblar los codos al cansarse"
      ]
    },
    {
      id: "paseo-cruzado",
      nombre: "Paseo cruzado",
      en: "Mixed Carry",
      cat: "Carga",
      patron: "Carga",
      nivel: 2,
      musculos: ["Core", "Hombros", "Oblicuos", "Antebrazos"],
      anim: "overhead_carry",
      double: false,
      unilateral: true,
      series: "3",
      reps: "20–30 m por lado",
      descanso: 60,
      pesoInicial: 16,
      desc: "Caminata con una pesa bloqueada arriba y otra al costado en la mano contraria. Desafía la estabilidad del tronco con cargas distintas.",
      cues: [
        "Pesa arriba bloqueada y la de abajo pegada al cuerpo",
        "Hombros firmes y torso vertical",
        "Cambia de lado a mitad de la serie"
      ],
      errores: [
        "Inclinarse hacia la pesa de abajo",
        "Perder el bloqueo del brazo de arriba"
      ]
    },

    /* ---------- Complejo ---------- */
    {
      id: "clean-press",
      nombre: "Clean + press",
      en: "Clean and Press",
      cat: "Complejo",
      patron: "Empuje",
      nivel: 2,
      musculos: ["Hombros", "Glúteos", "Tríceps", "Core"],
      anim: "clean",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "3–5 por lado",
      descanso: 90,
      pesoInicial: 16,
      desc: "Un clean al rack seguido de un press estricto en cada repetición. Combina potencia de cadera y fuerza de hombro.",
      cues: [
        "Clean limpio al rack y pausa breve antes del press",
        "Aprieta glúteos y abdomen antes de empujar",
        "Baja la pesa al rack y luego entre las piernas"
      ],
      errores: [
        "Usar el impulso del clean para empujar la pesa",
        "Recibir el rack con el codo separado del cuerpo"
      ]
    },
    {
      id: "clean-press-doble",
      nombre: "Clean + press doble",
      en: "Double Clean and Press",
      cat: "Complejo",
      patron: "Empuje",
      nivel: 3,
      musculos: ["Hombros", "Glúteos", "Tríceps", "Core"],
      anim: "clean",
      double: true,
      unilateral: false,
      series: "3–5",
      reps: "3–5",
      descanso: 120,
      pesoInicial: 16,
      desc: "Clean doble al rack seguido de un press doble. Un ejercicio completo para fuerza y potencia de todo el cuerpo.",
      cues: [
        "Clean doble con las pesas pegadas al cuerpo",
        "Rack firme y respiración antes del press",
        "Press parejo sin arquear la espalda"
      ],
      errores: [
        "Encadenar el press sin estabilizar el rack",
        "Inclinarse hacia atrás para terminar el press"
      ]
    },
    {
      id: "clean-sentadilla-frontal",
      nombre: "Clean + sentadilla frontal",
      en: "Clean and Front Squat",
      cat: "Complejo",
      patron: "Sentadilla",
      nivel: 2,
      musculos: ["Cuádriceps", "Glúteos", "Isquiotibiales", "Core"],
      anim: "front_squat",
      double: false,
      unilateral: true,
      series: "3–4",
      reps: "3–5 por lado",
      descanso: 90,
      pesoInicial: 20,
      desc: "Clean al rack seguido de una sentadilla frontal antes de volver la pesa abajo. Une bisagra y sentadilla en un mismo patrón.",
      cues: [
        "Asegura el rack antes de iniciar la sentadilla",
        "Baja con el torso erguido y el codo pegado",
        "Párate completo antes del siguiente clean"
      ],
      errores: [
        "Bajar a la sentadilla con el rack inestable",
        "Inclinar el torso hacia la pesa al subir"
      ]
    },
    {
      id: "thruster",
      nombre: "Thruster",
      en: "Kettlebell Thruster",
      cat: "Complejo",
      patron: "Sentadilla",
      nivel: 2,
      musculos: ["Cuádriceps", "Hombros", "Glúteos", "Tríceps"],
      anim: "thruster",
      double: false,
      unilateral: false,
      series: "3–5",
      reps: "8–12",
      descanso: 75,
      pesoInicial: 16,
      desc: "Sentadilla con la pesa frente al pecho que termina en un press sobre la cabeza en un solo movimiento. Muy exigente a nivel metabólico.",
      cues: [
        "Baja en sentadilla con la pesa cerca del pecho",
        "Usa el impulso de la subida para llevar la pesa arriba",
        "Bloquea arriba con costillas abajo"
      ],
      errores: [
        "Empujar con los brazos antes de extender las piernas",
        "Arquear la espalda en el bloqueo"
      ]
    },
    {
      id: "man-maker",
      nombre: "Man maker",
      en: "Man Maker",
      cat: "Complejo",
      patron: "Transición",
      nivel: 3,
      musculos: ["Core", "Dorsales", "Hombros", "Cuádriceps"],
      anim: "renegade_row",
      double: false,
      unilateral: false,
      series: "3–4",
      reps: "5–8",
      descanso: 90,
      pesoInicial: 12,
      desc: "Flexión de brazos y remo renegado sobre dos pesas, salto a cuclillas, clean y thruster. Complejo de cuerpo completo para fuerza y acondicionamiento.",
      cues: [
        "Plancha firme y sin girar la cadera en los remos",
        "Lleva los pies cerca de las pesas antes del clean",
        "Encadena las fases sin perder la técnica"
      ],
      errores: [
        "Rotar la cadera en los remos por fatiga",
        "Redondear la espalda al levantar las pesas del suelo"
      ]
    },
    {
      id: "ciclo-largo",
      nombre: "Ciclo largo",
      en: "Long Cycle Clean and Jerk",
      cat: "Complejo",
      patron: "Empuje",
      nivel: 3,
      musculos: ["Hombros", "Glúteos", "Cuádriceps", "Core"],
      anim: "jerk",
      double: false,
      unilateral: true,
      series: "3–5",
      reps: "5–10 por lado",
      descanso: 90,
      pesoInicial: 16,
      desc: "Clean seguido de jerk en cada repetición, como en el Girevoy Sport. Desarrolla resistencia, potencia y eficiencia técnica.",
      cues: [
        "Clean relajado y rack apoyado sobre la cadera",
        "Jerk con doble flexión y brazo bloqueado arriba",
        "Respira en cada fase y encuentra un ritmo constante"
      ],
      errores: [
        "Hacer press con el brazo en lugar de usar las piernas",
        "Tensar los brazos en el rack y quemarse antes de tiempo"
      ]
    }
  ];
})();
