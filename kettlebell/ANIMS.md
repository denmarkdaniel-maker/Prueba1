# Contrato de animaciones (compartido entre datos y motor 3D)

Claves de animación (`anim`). Cada ejercicio usa exactamente una.
Por defecto la pesa va como indica la columna "agarre". `double:true` => una pesa en cada mano
(solo válido donde el agarre es "1 mano").

| clave            | movimiento                                                        | agarre            |
|------------------|-------------------------------------------------------------------|-------------------|
| swing_2h         | Swing ruso a dos manos (bisagra, pesa a la altura del pecho)      | 2 manos, 1 pesa   |
| swing_1h         | Swing a una mano                                                  | 1 mano            |
| swing_alt        | Swing alternando mano en el punto alto                            | alterna           |
| swing_american   | Swing americano (pesa sobre la cabeza)                            | 2 manos, 1 pesa   |
| deadlift         | Peso muerto con pesa entre los pies                               | 2 manos, 1 pesa   |
| sl_deadlift      | Peso muerto a una pierna                                          | 1 mano            |
| suitcase_deadlift| Peso muerto maleta (pesa al costado)                              | 1 mano            |
| goblet_squat     | Sentadilla goblet (pesa por los cuernos frente al pecho)          | 2 manos, 1 pesa   |
| front_squat      | Sentadilla frontal en rack                                        | 1 mano            |
| sumo_high_pull   | Jalón alto sumo                                                   | 2 manos, 1 pesa   |
| clean            | Clean (cargada) al rack                                           | 1 mano            |
| press            | Press militar desde rack                                          | 1 mano            |
| push_press       | Push press (impulso de piernas)                                   | 1 mano            |
| jerk             | Jerk (doble flexión)                                              | 1 mano            |
| snatch           | Arrancada                                                         | 1 mano            |
| bent_row         | Remo inclinado                                                    | 1 mano            |
| renegade_row     | Remo renegado en plancha                                          | 1 mano (2 pesas visibles) |
| halo             | Halo alrededor de la cabeza                                       | 2 manos, 1 pesa   |
| around_world     | Alrededor del mundo (cintura)                                     | pasa de mano      |
| figure8          | Figura 8 entre las piernas                                        | pasa de mano      |
| windmill         | Molino (pesa arriba)                                              | 1 mano            |
| tgu              | Turkish get-up (levantamiento turco)                              | 1 mano            |
| reverse_lunge    | Zancada hacia atrás                                               | 1 mano            |
| lateral_lunge    | Zancada lateral / sentadilla cosaca (pesa goblet)                 | 2 manos, 1 pesa   |
| russian_twist    | Giro ruso sentado                                                 | 2 manos, 1 pesa   |
| floor_press      | Press de piso (acostado)                                          | 1 mano            |
| pullover         | Pullover acostado                                                 | 2 manos, 1 pesa   |
| farmer_carry     | Paseo del granjero (caminata)                                     | 1 mano            |
| overhead_carry   | Caminata del mesero (pesa arriba)                                 | 1 mano            |
| thruster         | Thruster (sentadilla + press)                                     | 2 manos, 1 pesa   |
| glute_bridge     | Puente de glúteos con pesa en la cadera                           | 2 manos, 1 pesa   |
| situp            | Abdominal con pesa al pecho / arriba                              | 2 manos, 1 pesa   |
