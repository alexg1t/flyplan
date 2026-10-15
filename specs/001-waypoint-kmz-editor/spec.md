# Feature Specification: Editor de misiones waypoint con exportación KMZ para DJI Fly

**Feature Branch**: `001-waypoint-kmz-editor`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Editor de misiones waypoint con exportación KMZ para DJI Fly (primera feature de flyplan). El piloto abre flyplan en el navegador del PC y ve un mapa con vista satélite. Hace clic en el mapa para añadir waypoints, los arrastra para moverlos, los borra y cambia su orden. Cada waypoint tiene altura, velocidad, ángulo del gimbal, rumbo del dron y una acción opcional (hacer foto, empezar vídeo, parar vídeo). La misión tiene valores globales: altura y velocidad por defecto, acción al terminar (volver a casa, aterrizar, quedarse en el sitio) y si el vuelo pierde la señal. La pantalla muestra la distancia total y el tiempo estimado de vuelo. Para exportar, el piloto carga una vez un KMZ de referencia que ha exportado de su propia app DJI Fly con el Air 3S. flyplan toma de ahí los valores del dron y genera un KMZ nuevo que DJI Fly abre sin errores. También puede abrir un KMZ de DJI Fly existente para verlo y editarlo. Antes de exportar, flyplan valida los límites del Air 3S y de DJI Fly (número máximo de waypoints, altura, velocidad, gimbal), bloquea la exportación si algo está fuera de límites y avisa si cualquier punto supera 120 m sobre el terreno. Una página de ayuda explica cómo copiar el KMZ al móvil y sustituir la misión ficticia en Android y en iOS. La cuadrícula de mapeo y la órbita/POI son features posteriores y quedan fuera de esta."

## Clarifications

### Session 2026-10-15

- Q: ¿La altura sobre el terreno se calcula solo respecto al punto de despegue o con datos de elevación del terreno? → A: Respecto al punto de despegue en esta feature; datos de elevación del terreno en una feature posterior.
- Q: ¿flyplan guarda varias misiones con nombre en el navegador o una sola misión en curso? → A: Una sola misión en curso en esta feature (los KMZ exportados son las copias guardadas); la biblioteca de misiones es una feature posterior.
- Q: ¿Cada waypoint admite una sola acción de cámara o una lista ordenada de acciones? → A: Lista ordenada (foto, empezar vídeo, parar vídeo, esperar N segundos); una sola acción es el caso más simple de la lista y se añade con un clic.
- Q: ¿Esta feature incluye disparo automático de fotos cada N metros a lo largo de la ruta (para ortomosaico)? → A: No; se decide en la feature de cuadrícula tras verificarlo con un KMZ real de DJI Fly. Esta feature solo tiene acciones por waypoint.
- Q: ¿Cómo abre el piloto flyplan: web publicada, archivo local o servidor local? → A: Web estática publicada en internet. El mismo resultado debe poder servirse desde un servidor local en el PC, y la lógica de misión y KMZ queda separada de la interfaz para que un servidor futuro pueda reutilizarla si una feature lo justifica.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diseñar una misión y exportarla para DJI Fly (Priority: P1)

El piloto abre flyplan en el navegador del PC. Ve un mapa satélite, busca la zona de vuelo y
hace clic para colocar waypoints. Todos los puntos usan la altura y la velocidad por defecto de
la misión. La primera vez carga el KMZ de referencia exportado de su DJI Fly con el Air 3S.
Pulsa "Exportar", flyplan valida la misión y descarga un KMZ listo para sustituir la misión
ficticia en el móvil.

**Why this priority**: es el recorrido mínimo que entrega valor. Sin un KMZ que DJI Fly abra,
el resto de la herramienta no sirve.

**Independent Test**: crear una misión de 5 waypoints, exportarla, copiarla al móvil y abrirla
en DJI Fly con el Air 3S. La vista previa en DJI Fly muestra los 5 puntos en el mismo sitio y
orden.

**Acceptance Scenarios**:

1. **Given** el mapa abierto y ninguna misión, **When** el piloto hace clic en 3 puntos del
   mapa, **Then** aparecen 3 waypoints numerados 1, 2 y 3 unidos por una línea en ese orden.
2. **Given** una misión válida y ningún KMZ de referencia cargado, **When** el piloto pulsa
   "Exportar", **Then** flyplan le pide el KMZ de referencia y explica cómo obtenerlo de
   DJI Fly.
3. **Given** una misión válida y un KMZ de referencia del Air 3S cargado, **When** el piloto
   pulsa "Exportar", **Then** se descarga un archivo KMZ y flyplan muestra el enlace a la
   guía de transferencia.
4. **Given** una misión con un waypoint fuera de límites, **When** el piloto pulsa
   "Exportar", **Then** la exportación se bloquea y flyplan indica qué waypoint y qué valor
   incumplen el límite.
5. **Given** una misión con un waypoint a más de 120 m sobre el punto de despegue, **When** el piloto
   pulsa "Exportar", **Then** flyplan muestra un aviso visible que nombra ese waypoint. El
   piloto debe confirmar el aviso antes de que se descargue el archivo.

---

### User Story 2 - Ajustar waypoints y parámetros de misión (Priority: P2)

El piloto selecciona un waypoint y cambia su altura, velocidad, ángulo del gimbal, rumbo y
acción (foto, empezar vídeo, parar vídeo o ninguna). Arrastra puntos para moverlos, borra
puntos y cambia su orden. En los parámetros globales fija la altura y la velocidad por
defecto, la acción al terminar y el comportamiento si se pierde la señal. Mientras edita,
la pantalla muestra la distancia total y el tiempo estimado de vuelo.

**Why this priority**: convierte una ruta básica en una misión útil para foto y vídeo, pero
la ruta básica de la historia 1 ya funciona sin esto.

**Independent Test**: crear una misión, cambiar los parámetros de un waypoint y los globales,
exportar y comprobar en DJI Fly que el waypoint muestra los valores nuevos.

**Acceptance Scenarios**:

1. **Given** una misión de 4 waypoints, **When** el piloto arrastra el waypoint 2 a otra
   posición, **Then** la línea, la distancia total y el tiempo estimado se actualizan al
   instante.
2. **Given** una misión de 4 waypoints, **When** el piloto borra el waypoint 2, **Then**
   quedan 3 waypoints renumerados 1, 2 y 3.
3. **Given** una misión de 4 waypoints, **When** el piloto mueve el waypoint 4 a la primera
   posición del orden, **Then** la ruta empieza por ese punto y los números se actualizan.
4. **Given** un waypoint sin valores propios, **When** el piloto cambia la altura por
   defecto de la misión, **Then** ese waypoint adopta la nueva altura. Un waypoint con altura
   propia no cambia.
5. **Given** un waypoint con las acciones "esperar 3 s" y "hacer foto", en ese orden,
   **When** el piloto exporta y abre la misión en DJI Fly, **Then** DJI Fly muestra ambas
   acciones en ese waypoint y en ese orden.

---

### User Story 3 - Abrir y editar un KMZ existente de DJI Fly (Priority: P2)

El piloto carga en flyplan un KMZ de una misión que ya tiene en DJI Fly. flyplan muestra los
waypoints en el mapa con todos sus parámetros. El piloto edita la misión y la exporta de
nuevo.

**Why this priority**: permite reutilizar misiones creadas en el móvil y corregirlas con la
comodidad del PC. Además, el mismo proceso de lectura sirve para el KMZ de referencia.

**Independent Test**: exportar una misión de DJI Fly, abrirla en flyplan, exportarla sin
cambios y comprobar que DJI Fly muestra la misma misión.

**Acceptance Scenarios**:

1. **Given** un KMZ válido exportado de DJI Fly, **When** el piloto lo abre en flyplan,
   **Then** el mapa muestra todos sus waypoints con altura, velocidad, gimbal, rumbo y acción.
2. **Given** un KMZ abierto en flyplan, **When** el piloto lo exporta sin cambios, **Then**
   el KMZ resultante contiene los mismos waypoints con los mismos parámetros.
3. **Given** un archivo que no es un KMZ de DJI Fly, **When** el piloto intenta abrirlo,
   **Then** flyplan muestra un mensaje claro y la misión actual no cambia.

---

### User Story 4 - Guía de transferencia al móvil (Priority: P3)

El piloto abre la página de ayuda. La guía explica paso a paso cómo crear la misión ficticia
en DJI Fly, cómo encontrar su carpeta y cómo sustituir el KMZ, en Android y en iOS. La guía
explica también cómo exportar el KMZ de referencia.

**Why this priority**: un piloto que ya conoce el procedimiento puede usar flyplan sin la
guía, pero sin ella un piloto nuevo no llega a volar la misión.

**Independent Test**: un piloto que no conoce el procedimiento sigue la guía y abre en
DJI Fly una misión exportada por flyplan, en Android y en iOS.

**Acceptance Scenarios**:

1. **Given** la página de ayuda, **When** el piloto elige Android, **Then** ve los pasos
   para Android, incluida la ruta de la carpeta de misiones y cómo copiar el archivo desde el
   PC.
2. **Given** la página de ayuda, **When** el piloto elige iOS, **Then** ve los pasos para
   iOS con la app Archivos.

---

### Edge Cases

- El KMZ de referencia podría ser de otro modelo de dron: flyplan muestra los valores de
  identificación detectados y pide al piloto que confirme que es de su Air 3S. Si no es de
  DJI Fly o no trae esos valores, lo rechaza.
- El KMZ de referencia o el KMZ a editar está dañado o no contiene una misión: flyplan
  muestra un mensaje y no modifica la misión actual.
- La misión supera el número máximo de waypoints: flyplan impide añadir más e indica el
  límite.
- Dos waypoints consecutivos están en la misma posición o casi: flyplan lo marca como error
  de validación.
- La misión tiene menos de 2 waypoints: la exportación se bloquea.
- El tiempo estimado de vuelo supera 35 minutos (aprox. 80 % de la autonomía máxima del
  Air 3S): flyplan muestra un aviso, pero permite exportar.
- El mapa no carga por falta de conexión: flyplan avisa. La misión en curso no se pierde.
- El piloto cierra la pestaña sin exportar: al volver, recupera la misión en curso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: flyplan MUST mostrar un mapa con vista satélite y permitir buscar un lugar por
  nombre o coordenadas.
- **FR-002**: Los pilotos MUST poder añadir un waypoint con un clic en el mapa, moverlo
  arrastrándolo, borrarlo y cambiar su posición en el orden de la ruta.
- **FR-003**: flyplan MUST mostrar los waypoints numerados en orden de vuelo y unidos por la
  línea de la ruta.
- **FR-004**: Cada waypoint MUST tener altura, velocidad, ángulo del gimbal, rumbo y una
  lista ordenada de acciones, que puede estar vacía. Si un valor no se fija en el waypoint,
  se usa el valor por defecto de la misión.
- **FR-004a**: Las acciones disponibles MUST ser: hacer foto, empezar vídeo, parar vídeo y
  esperar N segundos. El piloto MUST poder añadir una acción con un clic, quitarla y cambiar
  su orden. DJI Fly MUST ejecutar las acciones en el orden de la lista.
- **FR-005**: El rumbo de cada waypoint MUST poder ser "seguir la ruta" o un ángulo fijo en
  grados.
- **FR-006**: La misión MUST tener altura por defecto, velocidad por defecto, ángulo del
  gimbal por defecto, acción al terminar (volver a casa, aterrizar, quedarse en el sitio) y
  comportamiento ante pérdida de señal (continuar la misión o volver a casa).
- **FR-007**: flyplan MUST mostrar en todo momento la distancia total de la ruta y el tiempo
  estimado de vuelo, y actualizarlos con cada cambio.
- **FR-008**: flyplan MUST aceptar un KMZ de referencia exportado de DJI Fly con un Air 3S,
  guardarlo para próximas sesiones y usar sus valores de dron en cada exportación.
- **FR-009**: flyplan MUST rechazar un KMZ de referencia que no sea de DJI Fly o que no
  traiga los datos de identificación del dron. DJI no publica qué valor corresponde a cada
  modelo, así que flyplan MUST mostrar los valores detectados y pedir al piloto que confirme
  que el KMZ es de su Air 3S.
- **FR-010**: flyplan MUST generar un KMZ que DJI Fly abra sin errores en el Air 3S y que
  reproduzca los waypoints, parámetros y acciones de la misión.
- **FR-011**: Antes de exportar, flyplan MUST validar el número de waypoints, la altura, la
  velocidad y el ángulo del gimbal contra los límites del Air 3S en DJI Fly. Si algo está
  fuera de límites, flyplan MUST bloquear la exportación e indicar cada waypoint y valor
  afectado.
- **FR-012**: flyplan MUST avisar de forma visible cuando cualquier waypoint supere 120 m
  de altura respecto al punto de despegue. El piloto MUST confirmar el aviso antes de
  exportar. El aviso MUST recordar que esta altura no tiene en cuenta el relieve del terreno.
  El cálculo con datos de elevación del terreno bajo cada waypoint queda para una feature
  posterior.
- **FR-013**: flyplan MUST abrir un KMZ de DJI Fly existente y mostrarlo como misión
  editable.
- **FR-014**: flyplan MUST guardar automáticamente una única misión en curso en el
  navegador y recuperarla al volver a abrir la página. Para conservar una misión, el piloto
  la exporta a KMZ.
- **FR-015**: flyplan MUST ofrecer una página de ayuda en español con los pasos de
  transferencia para Android y para iOS, y los pasos para exportar el KMZ de referencia.
- **FR-016**: Todo el texto de la interfaz MUST estar en español.
- **FR-017**: La interfaz MUST recordar que flyplan no sustituye el criterio del piloto, la
  comprobación del espacio aéreo ni la revisión de la misión en DJI Fly antes de despegar.
- **FR-018**: Antes de sustituir la misión en curso (al abrir un KMZ o empezar una misión
  nueva), flyplan MUST pedir confirmación al piloto si la misión en curso tiene waypoints.
- **FR-019**: flyplan MUST funcionar abierto desde una dirección web pública, sin cuentas
  ni registro, y MUST funcionar igual servido desde un servidor local en el PC. Las misiones
  y el KMZ de referencia MUST NOT salir del navegador del piloto.

### Key Entities

- **Misión**: ruta completa. Tiene nombre, lista ordenada de waypoints, altura y velocidad
  por defecto, acción al terminar y comportamiento ante pérdida de señal. Calcula la
  distancia total y el tiempo estimado.
- **Waypoint**: punto de la ruta. Tiene posición (latitud y longitud), orden, una lista
  ordenada de acciones y, de forma opcional, altura, velocidad, ángulo del gimbal y rumbo
  propios.
- **Acción**: paso que el dron ejecuta al llegar a un waypoint: hacer foto, empezar vídeo,
  parar vídeo o esperar N segundos.
- **Perfil de dron**: valores del Air 3S leídos del KMZ de referencia. Se reutilizan en cada
  exportación.
- **Límites**: valores máximos y mínimos del Air 3S en DJI Fly (número de waypoints, altura,
  velocidad, gimbal) contra los que se valida la misión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un piloto crea y exporta una misión de 10 waypoints en menos de 5 minutos,
  con el KMZ de referencia ya cargado.
- **SC-002**: El 100 % de las misiones de prueba exportadas (mínimo 3, entre ellas una con
  acciones de cámara) se abren en DJI Fly sin errores y su vista previa coincide con el
  plan.
- **SC-003**: Ninguna misión fuera de límites llega a exportarse en las pruebas de límites.
- **SC-004**: Una misión de DJI Fly abierta y exportada sin cambios conserva el 100 % de sus
  waypoints y parámetros.
- **SC-005**: Un piloto que sigue la guía por primera vez transfiere una misión al móvil y
  la abre en DJI Fly en menos de 10 minutos, tanto en Android como en iOS.
- **SC-006**: La distancia total que muestra flyplan difiere menos de un 5 % de la que
  muestra DJI Fly para la misma misión.

## Assumptions

- El piloto usa un PC con navegador moderno y conexión a internet para cargar el mapa.
- flyplan se publica como web estática gratuita (por ejemplo GitHub Pages o un static site
  de Render). Si en el futuro una feature necesita servidor (por ejemplo, la biblioteca de
  misiones sincronizada o datos de terreno), se añade con una enmienda de la constitución.
  La lógica de misión y KMZ no depende de la interfaz, así que ese servidor podrá
  reutilizarla.
- El piloto tiene DJI Fly instalado en un móvil Android o iOS, conectado al RC-N3, y puede
  crear y exportar misiones waypoint con su Air 3S.
- El Air 3S no tiene SDK disponible. La única vía de entrega es sustituir el KMZ de una
  misión ficticia creada en DJI Fly.
- Las alturas de los waypoints son relativas al punto de despegue, igual que en DJI Fly.
- Los valores concretos de los límites (número máximo de waypoints, altura, velocidad,
  gimbal) se confirman en la fase de plan contra la documentación de DJI y KMZ reales.
- Los tramos entre waypoints son rectos. Las curvas y otras opciones de trayectoria quedan
  fuera de esta feature.
- Solo se aceptan KMZ en formato DJI Fly. Los formatos de Litchi u otras apps quedan fuera
  de esta feature.
- Uno de los propósitos principales de flyplan es planificar vuelos para ortomosaico. La
  feature de cuadrícula de mapeo generará waypoints con este mismo modelo de misión y esta
  misma exportación KMZ, así que ambos se diseñan para servirle de base sin rehacerse.
- El disparo automático de fotos por intervalo de distancia o tiempo queda fuera de esta
  feature. Se decide en la feature de cuadrícula tras verificar con un KMZ real si DJI Fly
  lo respeta.
- La cuadrícula de mapeo, la órbita/POI, el cálculo de altura con datos de elevación del
  terreno y la biblioteca de misiones con nombre son features posteriores.
- El tiempo estimado de vuelo se calcula con la distancia y las velocidades de la misión,
  más un margen por cada parada en waypoint. Es una estimación, no una garantía de batería.
