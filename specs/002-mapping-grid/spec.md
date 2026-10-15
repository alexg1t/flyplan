# Feature Specification: Planificación de vuelos para ortomosaico (cuadrícula de mapeo)

**Feature Branch**: `002-mapping-grid`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Planificación de vuelos para ortomosaico (cuadrícula de mapeo), segunda feature de flyplan. El piloto elige el tipo de misión "Área de mapeo" y dibuja en el mapa un polígono que delimita la zona a mapear. Los vértices del polígono NO son waypoints que vuele el dron: solo delimitan el área. Se cierra haciendo clic en el primer vértice y se pueden mover, añadir y borrar vértices. flyplan calcula automáticamente la ruta en cuadrícula (pasadas paralelas en patrón de ida y vuelta) que cubre todo el polígono y los puntos donde el dron tomará cada foto, y los dibuja sobre el mapa: la línea de la ruta que seguirá el dron, el punto de inicio y fin, y cada punto de foto. El piloto ajusta la altura de vuelo (o el GSD objetivo en cm/px), el solape frontal y lateral, la dirección de las pasadas y la velocidad; la ruta y los puntos de foto se recalculan al instante. La pantalla muestra el área (ha), el GSD, el número de pasadas, el número de fotos, la distancia y el tiempo estimado, y avisa si hacen falta varias baterías. Usa la cámara principal (gran angular) del DJI Air 3S con el gimbal a -90°. La misión se exporta como KMZ para DJI Fly reutilizando el modelo de misión y la exportación de la feature 001 (con su mismo bloqueo hasta verificar el formato con el KMZ real). Si la misión supera los 200 waypoints de DJI Fly, se divide en varias partes que se vuelan seguidas. La feature 001 dejó pendiente para esta feature decidir entre una parada con foto en cada punto o el disparo automático por intervalo de distancia; hay que verificar con un KMZ real si DJI Fly respeta el disparo por intervalo. Fuera de alcance: seguimiento del terreno, misiones oblicuas o en doble cuadrícula para modelos 3D y procesamiento de las fotos."

## Clarifications

### Session 2026-10-15

- Q: ¿Modo de disparo: parada con foto en cada punto, disparo por intervalo de distancia o ambos? → A: Ambos, a elegir. Parada con foto por defecto; el disparo por intervalo queda desactivado hasta verificar con un KMZ real que DJI Fly lo respeta.
- Q: ¿La misión se divide solo por 200 waypoints o también por batería? → A: Por batería y por 200 waypoints, con un máximo de 25 minutos de vuelo estimado por parte.
- Q: ¿Con qué resolución se hacen las fotos: 12 MP o 50 MP? → A: A elegir en los parámetros del mapeo, 12 MP por defecto. GSD, velocidad máxima y tiempo se calculan con la resolución elegida.
- Q: ¿Se puede guardar el área en un archivo KML e importar áreas de otras herramientas? → A: No. Solo el autoguardado de la misión en curso; el área se redibuja cuando haga falta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dibujar el área y ver la ruta y los puntos de foto (Priority: P1)

El piloto elige el tipo de misión "Área de mapeo" y marca en el mapa los vértices de la zona a
mapear. Al hacer clic en el primer vértice, el polígono se cierra. flyplan dibuja dentro la
ruta en cuadrícula que seguirá el dron, marca el inicio y el fin, y muestra cada punto donde
tomará una foto. El resumen indica el área, el GSD, las pasadas, las fotos, la distancia, el
tiempo estimado y las baterías necesarias.

**Why this priority**: es lo que el piloto necesita para planificar un ortomosaico. Ver la ruta
y las fotos antes de volar permite comprobar la cobertura y el tiempo, aunque todavía no se
pueda exportar.

**Independent Test**: dibujar un cuadrado de unos 100 m de lado con los valores por defecto y
comprobar que aparecen la ruta en cuadrícula, los puntos de foto, el inicio, el fin y el
resumen, y que la cuadrícula cubre todo el cuadrado.

**Acceptance Scenarios**:

1. **Given** el tipo de misión "Área de mapeo" y un mapa vacío, **When** el piloto marca 4
   vértices y hace clic en el primero, **Then** el polígono se cierra y aparecen la ruta, los
   puntos de foto, el inicio y el fin.
2. **Given** un polígono cerrado, **When** el piloto mira el mapa, **Then** distingue sin
   ambigüedad los vértices del área, la ruta del dron y los puntos de foto (aspecto distinto).
3. **Given** un polígono cerrado, **When** el piloto arrastra un vértice, **Then** la ruta, los
   puntos de foto y el resumen se recalculan al soltarlo.
4. **Given** un polígono cerrado, **When** el piloto añade un vértice en un lado o borra uno,
   **Then** el área cambia y todo se recalcula. Si quedan menos de 3 vértices, el polígono deja
   de estar cerrado y la ruta desaparece.
5. **Given** un polígono cuyos lados se cruzan, **When** se intenta cerrar o al mover un
   vértice, **Then** flyplan indica que el área no es válida y no dibuja la ruta.

---

### User Story 2 - Ajustar los parámetros del mapeo (Priority: P2)

El piloto cambia la altura de vuelo o el GSD objetivo, el solape frontal y lateral, la
dirección de las pasadas y la velocidad. La ruta, los puntos de foto y el resumen cambian al
instante para que vea el efecto de cada ajuste.

**Why this priority**: los valores por defecto sirven para empezar, pero cada trabajo necesita
un GSD, un solape y un tiempo de vuelo distintos.

**Independent Test**: con un polígono cerrado, subir el solape lateral de 70 % a 80 % y
comprobar que aumentan las pasadas y las fotos; cambiar la dirección 90° y comprobar que las
pasadas giran.

**Acceptance Scenarios**:

1. **Given** un polígono cerrado, **When** el piloto cambia la altura, **Then** el GSD se
   actualiza y la separación entre pasadas y entre fotos cambia en proporción.
2. **Given** un polígono cerrado, **When** el piloto escribe un GSD objetivo, **Then** flyplan
   calcula la altura que lo consigue y la muestra.
3. **Given** un polígono cerrado, **When** el piloto sube el solape lateral, **Then** aumenta el
   número de pasadas.
4. **Given** un polígono cerrado, **When** el piloto sube el solape frontal, **Then** aumenta el
   número de fotos por pasada.
5. **Given** un polígono cerrado, **When** el piloto cambia la dirección de las pasadas,
   **Then** la cuadrícula gira a ese ángulo y sigue cubriendo todo el polígono.
6. **Given** el modo Disparo por intervalo y una velocidad que no deja tiempo suficiente entre
   dos fotos seguidas, **When** el piloto la elige, **Then** flyplan avisa e indica la
   velocidad máxima posible. (Se prueba cuando el modo esté activado, T029.)

---

### User Story 3 - Exportar el área como misión de DJI Fly (Priority: P2)

El piloto exporta la misión de mapeo. flyplan valida la misión con los mismos límites que la
feature 001 y descarga uno o varios KMZ. Si la misión dura más de 25 minutos o supera los 200
waypoints de DJI Fly, la divide en partes numeradas (una por batería) que se vuelan una detrás
de otra.

**Why this priority**: es lo que permite volar el plan, pero depende del mismo bloqueo de
exportación que la feature 001 (verificación con el KMZ real).

**Independent Test**: exportar un área pequeña, instalarla en DJI Fly y comprobar que la vista
previa coincide con la ruta de flyplan. Exportar un área grande y comprobar que salen varias
partes que juntas cubren la ruta completa.

**Acceptance Scenarios**:

1. **Given** una misión de mapeo válida y la exportación verificada, **When** el piloto
   exporta, **Then** se descarga un KMZ con la ruta en cuadrícula, a altura constante y con el
   gimbal a -90°.
2. **Given** una misión de mapeo de más de 25 minutos o de más de 200 waypoints, **When** el
   piloto exporta, **Then** se descargan varias partes numeradas ("parte 1 de N"…). Cada una
   dura 25 minutos de mapeo como máximo, tiene 200 waypoints como máximo y continúa en el
   siguiente punto de foto después del último de la parte anterior.
3. **Given** una misión dividida en partes, **When** el piloto mira el mapa, **Then** ve dónde
   empieza y termina cada parte.
4. **Given** la exportación todavía bloqueada (feature 001, `WPML_VERIFIED`), **When** el piloto
   exporta, **Then** ve el mismo mensaje de exportación desactivada que en la feature 001.

---

### Edge Cases

- Área más pequeña que lo que cubre una sola foto: se genera al menos una pasada con las
  fotos necesarias para cubrirla.
- Polígono cóncavo (por ejemplo, en forma de L): la cuadrícula cubre todo el polígono; donde
  una pasada sale del área, el dron la cruza para llegar al tramo siguiente.
- Polígono con lados que se cruzan: no es válido y no se calcula la ruta.
- Área muy grande: el resumen indica cuántas baterías hacen falta y cuántas partes saldrán.
- Demasiadas fotos (más de 20 000, por ejemplo un área grande a poca altura): flyplan no
  dibuja la ruta y pide subir la altura o reducir el área.
- Solapes en los extremos permitidos (por ejemplo, 90 %): la ruta crece mucho; el resumen lo
  refleja y avisa si se superan los límites.
- Cambiar el tipo de misión con contenido en el mapa: flyplan pide confirmación antes de
  sustituir la misión en curso (igual que FR-018 de la feature 001).
- Altura por encima de 120 m: mismo aviso que en la feature 001 (respecto al punto de
  despegue, sin tener en cuenta el relieve).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: flyplan MUST permitir elegir el tipo de misión: "Ruta de waypoints" (feature
  001) o "Área de mapeo". Una misión es de un solo tipo.
- **FR-002**: En "Área de mapeo", el piloto MUST poder marcar vértices con clics en el mapa,
  cerrar el polígono con un clic en el primer vértice (con 3 o más vértices), mover vértices
  arrastrándolos, añadir un vértice en cualquier lado y borrar vértices.
- **FR-003**: Los vértices del polígono MUST NOT convertirse en waypoints del vuelo; solo
  delimitan el área.
- **FR-004**: flyplan MUST rechazar un polígono cuyos lados se crucen y explicar por qué.
- **FR-005**: Con un polígono cerrado y válido, flyplan MUST calcular una ruta de pasadas
  paralelas en patrón de ida y vuelta y los puntos de foto, de forma que las fotos cubran el
  100 % del polígono con los solapes elegidos.
- **FR-006**: El mapa MUST mostrar la ruta del dron, su punto de inicio y su punto de fin, y
  cada punto de foto, con un aspecto distinto al de los vértices del área.
- **FR-007**: Los parámetros del mapeo MUST ser: altura de vuelo, GSD objetivo (vinculado a la
  altura), resolución de foto (12 MP o 50 MP, 12 MP por defecto), solape frontal, solape
  lateral, dirección de las pasadas y velocidad. El GSD, la velocidad máxima (FR-011) y el
  tiempo estimado MUST calcularse con la resolución elegida, y la interfaz MUST recordar que
  hay que poner esa misma resolución en la cámara de DJI Fly.
- **FR-008**: Cualquier cambio en el polígono o en los parámetros MUST recalcular la ruta, los
  puntos de foto y el resumen sin que el piloto pulse ningún botón.
- **FR-009**: El resumen MUST mostrar el área (ha), el GSD (cm/px), el número de pasadas, el
  número de fotos, la distancia, el tiempo estimado y el número de baterías necesarias.
- **FR-010**: El número de baterías del resumen MUST ser el número de partes de FR-015.
  Cuando haga falta más de una, flyplan MUST avisarlo.
- **FR-011**: Solo en el modo **Disparo por intervalo**: flyplan MUST avisar cuando la
  velocidad elegida no deje tiempo suficiente entre dos fotos seguidas e indicar la velocidad
  máxima posible. En el modo parada no aplica, porque el dron se detiene en cada foto.
- **FR-012**: La exportación MUST reutilizar el KMZ de referencia, la validación de límites, el
  aviso de 120 m y el bloqueo de exportación de la feature 001. La misión exportada vuela a
  altura constante con el gimbal a -90°.
- **FR-013**: Cuando la misión se divide (FR-015), las partes MUST ir numeradas ("parte 1 de
  N"…), volarse seguidas y mostrarse en el mapa con su inicio y su fin.
- **FR-014**: El piloto MUST poder elegir el modo de disparo:
  - **Parada con foto** (por defecto): un waypoint con foto en cada punto de foto.
  - **Disparo por intervalo de distancia**: waypoints solo en los extremos de cada pasada y
    una foto cada N metros. Este modo MUST estar desactivado, con una explicación, hasta que
    se verifique con un KMZ real que DJI Fly lo respeta (constitución I).
- **FR-015**: flyplan MUST dividir la misión en partes de **25 minutos de vuelo estimado como
  máximo** (una batería por parte) y de 200 waypoints como máximo. Cada parte continúa en el
  siguiente punto de foto después del último de la parte anterior; entre partes, el dron
  vuelve a casa. Los 25 min son de mapeo: no incluyen el trayecto del despegue a la primera
  foto ni la vuelta.
- **FR-016**: flyplan MUST guardar automáticamente en el navegador la misión de mapeo en curso
  (polígono y parámetros), igual que la misión de la feature 001.
- **FR-017**: La página de ayuda MUST explicar cómo preparar la cámara en DJI Fly para un
  ortomosaico (formato de foto, enfoque y exposición recomendados) y cómo volar una misión
  dividida en partes.
- **FR-018**: Todo el texto de la interfaz MUST estar en español.
- **FR-019**: Si el área necesita más de 20 000 fotos, flyplan MUST no calcular la ruta y
  MUST mostrar el motivo y cómo resolverlo (subir la altura o reducir el área).

### Key Entities

- **Área de mapeo**: polígono cerrado que delimita la zona. Lista ordenada de vértices
  (latitud y longitud). No se vuela.
- **Parámetros de mapeo**: altura, GSD, resolución de foto, solape frontal, solape lateral,
  dirección de las pasadas, velocidad y modo de disparo.
- **Cuadrícula calculada**: resultado derivado del área y los parámetros. Contiene las
  pasadas, los puntos de foto, la ruta completa (con inicio y fin) y el resumen. No se guarda:
  se recalcula.
- **Parte de misión**: tramo de la ruta que cabe en una misión de DJI Fly. Tiene número, inicio
  y fin.
- **Cámara**: características de la cámara principal del Air 3S que determinan lo que cubre
  cada foto y el GSD.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un piloto dibuja un área de 4 a 6 vértices y ve la ruta completa con los puntos
  de foto en menos de 1 minuto.
- **SC-002**: Para áreas de hasta 50 ha, la ruta y los puntos de foto se actualizan sin retardo
  apreciable (menos de medio segundo) tras cada cambio.
- **SC-003**: En las pruebas con polígonos convexos y cóncavos, las fotos planificadas cubren
  el 100 % del área con al menos los solapes elegidos.
- **SC-004**: El GSD que muestra flyplan difiere menos de un 5 % del calculado a mano con las
  características de la cámara.
- **SC-005**: Las misiones exportadas (incluidas las divididas en partes) se abren en DJI Fly y
  su vista previa coincide con la ruta de flyplan (comprobación manual, tras verificar la
  exportación).
- **SC-006**: Un vuelo de prueba sobre un área de 1 ha o menos produce un número de fotos que
  difiere menos de un 5 % del planificado, y un programa de fotogrametría las une sin huecos.

## Assumptions

- Solo fotos verticales (nadir) con la cámara principal gran angular del Air 3S. Sus datos
  (tamaño de sensor, distancia focal, resolución y tiempo mínimo entre fotos) se confirman en
  la fase de plan.
- Terreno aproximadamente plano: la altura es relativa al punto de despegue, igual que en la
  feature 001. El seguimiento del terreno queda fuera de esta feature.
- Valores por defecto: altura 60 m, resolución 12 MP, solape frontal 80 %, solape lateral
  70 %, velocidad 5 m/s y dirección alineada con el lado más largo del polígono.
- La ruta empieza en el extremo de la primera pasada más cercano al primer vértice del
  polígono.
- Las pasadas se alargan lo necesario más allá del borde del polígono para que las fotos
  cubran también los bordes.
- La exportación sigue bloqueada hasta que la feature 001 verifique el formato con el KMZ real
  (T035). Esta feature puede construirse y probarse antes; solo la exportación real espera.
- Fuera de alcance: seguimiento del terreno, misiones oblicuas o en doble cuadrícula,
  procesamiento de las fotos, zonas de exclusión dentro del polígono e importación o
  exportación del área como archivo (KML u otro). El área solo se conserva con el
  autoguardado de la misión en curso (FR-016).
- En una misión dividida, cada parte termina volviendo a casa para cambiar la batería. La
  última parte usa la acción al terminar de la misión.
