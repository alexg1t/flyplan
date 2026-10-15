# Feature Specification: Simulación 2D del vuelo

**Feature Branch**: `003-flight-simulation`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Simulación 2D del vuelo (tercera feature de flyplan). Sobre el mapa, el piloto puede reproducir una simulación de cómo volará el dron la misión en curso, tanto en una ruta de waypoints (feature 001) como en un área de mapeo (feature 002). Un icono del dron recorre la ruta en orden, con su rumbo, a una velocidad proporcional a la real (la velocidad de cada tramo y las paradas en cada punto) y con un multiplicador de velocidad de reproducción. Mientras avanza, los puntos de foto ya tomados cambian de aspecto, se ve la huella de la foto actual y el tramo ya recorrido se distingue del pendiente. Controles: reproducir, pausar, reiniciar, elegir la velocidad de reproducción y una barra de progreso para saltar a cualquier momento. Un panel muestra el tiempo simulado transcurrido y restante, la distancia recorrida, la foto o waypoint actual, la parte actual (en misiones divididas) y la altura. La simulación usa los mismos cálculos de tiempo que el resumen de la misión, para que coincidan. Es solo visual: no modifica la misión ni se exporta. Fuera de alcance: vista 3D, simulación de viento, de batería real o de obstáculos."

## Clarifications

### Session 2026-10-15

- Q: ¿Se simula también el despegue desde un punto que marca el piloto, o solo el recorrido de la misión? → A: Se simulan la ida, la vuelta a casa entre partes y la vuelta final, con el tiempo de cada batería. (Que el punto fuera opcional quedó sustituido por la respuesta siguiente.)
- Q: ¿El punto de despegue debe ser obligatorio? → A: Sí, obligatorio para simular y para exportar, como el "Planned Home" de QGroundControl. flyplan lo pide al empezar la misión y se puede mover. En las áreas de mapeo, la ruta empieza en el extremo más cercano al despegue.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver cómo vuela el dron un área de mapeo (Priority: P1)

Con un área de mapeo cerrada, el piloto pulsa "Simular". Un icono del dron recorre las pasadas
en orden, se detiene en cada punto de foto y la marca como tomada, y muestra sobre el mapa la
huella de la foto actual. El tramo ya recorrido se ve distinto del pendiente. El piloto
comprueba así el orden de las pasadas, los giros, el cambio entre partes y la cobertura de
las fotos.

**Why this priority**: es lo que pidió el piloto para entender en detalle cómo volará el dron
dentro del polígono antes de ir al campo.

**Independent Test**: con un área de mapeo de unas 2 ha, pulsar "Simular" y comprobar que el
dron recorre todos los puntos de foto en el orden de la ruta, que cada foto queda marcada al
pasar y que el tiempo final coincide con el tiempo del resumen.

**Acceptance Scenarios**:

1. **Given** un área de mapeo cerrada y válida, **When** el piloto pulsa "Simular", **Then** el
   icono del dron empieza en el punto "Inicio" y avanza por la ruta en orden.
2. **Given** la simulación en marcha, **When** el dron llega a un punto de foto, **Then** se
   detiene el tiempo de parada, el punto cambia a "tomada" y se dibuja la huella de esa foto.
3. **Given** la simulación en marcha, **When** el piloto mira el mapa, **Then** distingue el
   tramo recorrido del pendiente y el icono apunta en la dirección de avance.
4. **Given** una misión dividida en partes, **When** el dron termina una parte, **Then** el panel
   muestra el cambio a la parte siguiente.
5. **Given** la simulación terminada, **When** el piloto mira el panel, **Then** el tiempo de
   misión (sin ida ni vuelta) coincide con el tiempo del resumen, y el tiempo total con ida y
   vuelta se muestra aparte.
6. **Given** una misión de 2 partes, **When** se simula,
   **Then** el dron despega, va al inicio de la parte 1, la vuela, vuelve a casa, aterriza,
   va al inicio de la parte 2, la vuela y vuelve a casa. El panel muestra el tiempo de cada
   batería con la ida y la vuelta incluidas.

---

### User Story 2 - Controlar la reproducción (Priority: P1)

El piloto pausa, reanuda, reinicia, cambia la velocidad de reproducción y arrastra una barra de
progreso para saltar a cualquier momento del vuelo. El panel muestra en todo momento el tiempo
transcurrido y restante, la distancia recorrida, el punto actual, la parte y la altura.

**Why this priority**: una misión real dura muchos minutos; sin acelerar y saltar, la
simulación no es útil.

**Independent Test**: arrastrar la barra al 50 % y comprobar que el dron aparece a mitad de la
ruta y que el tiempo transcurrido es la mitad del total; cambiar la velocidad y comprobar que
el dron avanza más rápido.

**Acceptance Scenarios**:

1. **Given** la simulación en marcha, **When** el piloto pulsa "Pausa", **Then** el dron se
   detiene y el tiempo deja de avanzar hasta que pulse "Reproducir".
2. **Given** la simulación en cualquier punto, **When** el piloto pulsa "Reiniciar", **Then** el
   dron vuelve al inicio y todas las fotos pasan a "pendiente".
3. **Given** una velocidad de reproducción ×10, **When** pasan 10 segundos reales, **Then** el
   tiempo simulado avanza unos 100 segundos.
4. **Given** la simulación en cualquier estado, **When** el piloto arrastra la barra de
   progreso, **Then** el dron, las fotos tomadas, el tramo recorrido y el panel se colocan en
   ese momento del vuelo.

---

### User Story 3 - Simular una ruta de waypoints (Priority: P2)

Con una ruta de waypoints (feature 001), la simulación funciona igual: el dron recorre los
waypoints en orden, a la velocidad de cada tramo, se detiene en cada uno el tiempo de parada y
de sus esperas, y el panel muestra el waypoint actual, la acción que ejecuta y la altura.

**Why this priority**: la simulación también ayuda en las rutas, pero el piloto la pidió sobre
todo para el ortomosaico.

**Independent Test**: simular una ruta de 4 waypoints con una espera de 3 s y comprobar que el
dron se detiene 3 s más en ese waypoint y que el tiempo final coincide con el del resumen.

**Acceptance Scenarios**:

1. **Given** una ruta de 2 o más waypoints, **When** el piloto pulsa "Simular", **Then** el dron
   recorre los waypoints en orden y se detiene en cada uno.
2. **Given** un waypoint con acciones, **When** el dron llega a él, **Then** el panel muestra las
   acciones que ejecuta (foto, vídeo, espera).
3. **Given** una ruta cerrada (feature 001, FR-002a), **When** termina la simulación, **Then** el
   dron acaba en el punto de inicio.

---

### Edge Cases

- Misión sin ruta (área sin cerrar o no válida, o ruta con menos de 2 waypoints) o sin punto
  de despegue: "Simular" está desactivado y explica por qué.
- El piloto edita la misión durante la simulación: la simulación se detiene y vuelve al
  inicio con la misión nueva.
- La misión es muy larga (por ejemplo, 8 partes): la barra de progreso y la velocidad máxima de
  reproducción permiten verla entera en menos de 2 minutos reales.
- Punto de despegue lejos del área (por ejemplo, a más de 1 km): la ida y la vuelta se ven en
  la simulación y en el tiempo de cada batería, y salta el aviso de FR-012 si una batería
  supera 35 minutos.
- La pestaña del navegador pasa a segundo plano: al volver, la simulación sigue donde debía
  estar según el tiempo, o queda en pausa, pero sin saltos raros.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: flyplan MUST ofrecer un botón "Simular" cuando la misión en curso tenga una ruta
  (área de mapeo cerrada y válida, o ruta de 2 o más waypoints) y un punto de despegue
  (FR-010).
- **FR-002**: La simulación MUST mover un icono del dron por la ruta en el orden de vuelo, con
  el icono orientado en la dirección de avance.
- **FR-003**: El tiempo simulado MUST seguir el mismo modelo de tiempo que el resumen de la
  misión: cada tramo a su velocidad y una parada en cada punto (más las esperas en las rutas
  y el tiempo de cámara en las áreas). El tiempo total simulado MUST coincidir con el del
  resumen.
- **FR-004**: Mientras avanza, la simulación MUST distinguir el tramo recorrido del pendiente y
  marcar como tomados los puntos de foto ya pasados.
- **FR-005**: En un área de mapeo, la simulación MUST dibujar la huella de la foto actual con su
  orientación real (lado largo transversal a la pasada).
- **FR-006**: Los controles MUST incluir reproducir, pausar, reiniciar, velocidad de
  reproducción (×1, ×5, ×10, ×30, ×60 y ×120; ×120 hace falta para SC-004) y una barra de
  progreso para saltar a cualquier momento.
- **FR-007**: Un panel MUST mostrar el tiempo simulado transcurrido y restante, la distancia
  recorrida, el punto actual (foto o waypoint, con su número), la parte actual en misiones
  divididas, la altura y, en rutas, las acciones del waypoint actual.
- **FR-008**: Cualquier cambio en la misión MUST detener la simulación y volverla al inicio.
- **FR-009**: La simulación MUST NOT modificar la ruta ni lo que se exporta. El punto de
  despegue (FR-010) se guarda con la misión, pero no entra en el KMZ.
- **FR-010**: Toda misión (ruta o área) MUST tener un **punto de despegue**, que se guarda con
  la misión y se puede mover arrastrándolo, pero no quitar.
  - Mientras no exista, el primer clic en el mapa lo coloca, y la interfaz indica "Primero
    marca el punto de despegue".
  - Un botón "Mover despegue" permite recolocarlo con el siguiente clic.
  - Las misiones guardadas antes de esta feature, o abiertas desde un KMZ, no lo tienen: el
    siguiente clic en el mapa lo coloca.
- **FR-012**: La simulación MUST incluir el despegue, la ida hasta el primer punto, la vuelta a
  casa y el aterrizaje al final de cada parte, y la ida desde casa al inicio de la parte
  siguiente. El panel MUST mostrar el tiempo total de cada batería (parte + ida + vuelta) y
  MUST avisar si alguna supera 35 minutos (el 80 % de la autonomía del Air 3S, mismo umbral
  que la feature 001).
- **FR-013**: Exportar (features 001 y 002) MUST requerir el punto de despegue. Sin él,
  flyplan muestra "Marca el punto de despegue antes de exportar".
- **FR-014**: En un área de mapeo, la ruta MUST empezar en el extremo de la cuadrícula más
  cercano al punto de despegue. Esto sustituye la regla de la feature 002, que usaba el
  vértice 1.
- **FR-011**: Todo el texto MUST estar en español.

### Key Entities

- **Simulación**: estado de la reproducción: tiempo simulado actual, en marcha o en pausa,
  velocidad de reproducción.
- **Línea de tiempo**: lista de tramos y paradas derivada de la misión (y del punto de
  despegue, si lo hay), con el momento de inicio y la duración de cada uno. Permite saber
  dónde está el dron en cualquier instante.
- **Punto de despegue**: posición obligatoria (latitud y longitud) desde la que despega y a la
  que vuelve el dron, y referencia de todas las alturas. Se guarda con la misión en curso. No
  se exporta: en DJI Fly, el despegue real es donde esté el dron al iniciar la misión, así que
  el piloto debe despegar desde el punto planificado o cerca de él. En este documento, "casa"
  y "vuelta a casa" se refieren a este punto, igual que el RTH de DJI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El tiempo simulado de la misión, sin ida ni vuelta, difiere menos de 1 segundo
  del tiempo estimado que muestra el resumen.
- **SC-002**: Al saltar a un momento con la barra de progreso, el dron aparece en la posición
  correcta de la ruta en menos de un cuarto de segundo, también en áreas de 50 ha.
- **SC-003**: La animación se ve fluida (sin saltos visibles) con 1500 puntos de foto en el mapa.
- **SC-004**: Un piloto ve una misión de 8 partes completa en menos de 2 minutos reales usando
  la velocidad máxima.
- **SC-005**: En una prueba con el piloto, este identifica sin ayuda el orden de las pasadas y
  dónde empieza cada parte después de ver la simulación una vez.

## Assumptions

- La simulación es en 2D sobre el mapa. La altura se muestra como un número en el panel, no
  en 3D.
- El dron vuela en línea recta entre puntos a la velocidad del tramo, sin modelar aceleración
  ni frenado. Las paradas absorben ese tiempo, igual que en el resumen.
- Velocidad de reproducción por defecto: ×10.
- Ida y vuelta: subida y bajada vertical a 5 m/s hasta la altura de la misión, y trayecto
  horizontal en línea recta a la velocidad de la misión.
- Todas las partes de una misión despegan desde el mismo punto de despegue.
- Esta feature cambia dos comportamientos ya construidos: la exportación de las features 001
  y 002 exige el punto de despegue (FR-013), y la cuadrícula de la feature 002 empieza en el
  extremo más cercano al despegue (FR-014). También cambia el primer clic de una misión nueva
  en las features 001 y 002: ahora coloca el punto de despegue (FR-010). Y el tiempo del
  resumen de un área pasa a ser la suma del tiempo de sus partes, sin el tramo entre partes. Es una
  estimación prudente; la vuelta a casa real de DJI Fly suele ir más rápido.
- Solo hay una simulación a la vez y no se guarda: al recargar la página empieza parada.
- Fuera de alcance: vista 3D, viento, consumo real de batería, obstáculos y terreno.
