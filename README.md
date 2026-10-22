# Clase 5 — Patrones de diseño (con la IA como tutora)

> **Proyecto:** TicketBox · venta de entradas para eventos
> **Tema:** identificar qué patrón pide cada trozo de código… y cuál no pide ninguno

---

## Esta clase funciona distinto

En las cuatro clases anteriores sabías qué buscar: te decíamos el principio y tú
lo aplicabas. Aquí no.

`CheckoutService` tiene 250 líneas y **varios problemas de diseño distintos, cada
uno con un patrón clásico como respuesta**. No te vamos a decir cuáles son. Ese
es exactamente el ejercicio: en el mundo real nadie te avisa de que "esto pide un
Strategy".

En clase hemos visto unos pocos patrones. Hay muchos más, y nadie se los sabe
todos de memoria. Lo que sí puedes hacer —y lo que vamos a practicar— es **usar
la IA como tutora**: que analice el código, te diga qué patrones encajan, te
explique cada uno, y sobre todo **que te diga cuáles NO merecen la pena aquí**.

Porque el error típico de quien acaba de aprender patrones no es no conocerlos.
Es meterlos todos.

---

## Puesta en marcha

```bash
npm install
npm test          # 30 tests, todos en verde
npm run demo      # una compra completa con log, reintentos y ciclo de vida
```

---

## Qué hay dentro

```
src/
  types.ts
  order.ts                       Pedido con su ciclo de vida
  checkout-service.ts            ⟵ El corazón del ejercicio
  legacy/
    payments-gateway-v1.ts       Pasarela de pagos de 2011 (no se puede tocar)
  notifications/
    side-effects.ts              Los cinco sistemas a los que hay que avisar
  demo.ts
test/
  order.test.ts                  13 tests
  checkout-service.test.ts       17 tests
```

---

## Tu misión

### Fase 1 — Diagnóstico (sin escribir código)

Lee `checkout-service.ts` y `order.ts` de arriba abajo y **escribe una lista de
problemas de diseño en lenguaje llano**, sin nombrar ningún patrón todavía.

Frases del tipo: *"para añadir un método de pago hay que editar un switch de 80
líneas"*, o *"el servicio conoce por su nombre a los cinco sistemas a los que
avisa"*.

Este paso es el que casi todo el mundo se salta, y es el importante: **el patrón
es la respuesta, y no puedes elegir respuesta si no has escrito la pregunta.**

### Fase 2 — La IA como tutora

Ahora sí, pide ayuda. Para cada problema de tu lista, averigua:

- Qué patrón (o patrones) lo resuelven
- Qué problema resuelve ese patrón **en general**, más allá de este código
- Cómo quedaría aplicado **a este proyecto concreto**
- Qué coste tiene: cuántos archivos nuevos, cuánta indirección
- **Cuándo NO usarlo**

Guarda las explicaciones: son material de estudio, y la mitad del valor de esta
clase está ahí.

> En el vídeo de resolución verás los prompts exactos que uso para esto, incluida
> la parte más importante: cómo pedirle que **critique** su propia propuesta.

### Fase 3 — Decide (y justifica lo que descartas)

De todos los patrones que hayan salido, elige **dos o tres** y aplícalos. No más.

Y escribe una frase por cada patrón que hayas descartado explicando por qué. Un
"aquí no compensa porque solo hay dos casos y no se esperan más" es una respuesta
de senior. Aplicarlos todos, no.

> Acuérdate de la clase 4: un patrón aplicado sin necesidad **es** una violación
> de YAGNI y de KISS. Los patrones no son puntos que sumas; son deuda que
> contraes a cambio de flexibilidad. Si no vas a cobrar esa flexibilidad, es solo
> deuda.

### Fase 4 — Refactoriza

Aplica los patrones elegidos con los 30 tests en verde en todo momento. Un paso
pequeño, tests, siguiente paso.

---

## Criterios de aceptación

1. `npm test` en verde. **Los tests no se tocan.**
2. `npm run typecheck` sin errores.
3. `CheckoutService.checkout()` baja de 150 líneas a menos de 40.
4. Entregas un documento corto (`ANALISIS.md`) con:
   - la lista de problemas de la Fase 1,
   - los patrones considerados,
   - los aplicados y por qué,
   - **los descartados y por qué**.
5. Añades un método de pago nuevo (**Apple Pay**, comisión del 1 %) y un sistema
   nuevo al que avisar (**antifraude**), y en el PR se ve que cada uno es un
   archivo nuevo y cero modificaciones en el servicio.

---

## Pistas (solo si te bloqueas del todo)

<details>
<summary>Pista 1 — dónde mirar</summary>

Hay al menos seis puntos calientes. Por si te sirven de guía, sin decirte qué
patrón es cada uno:

1. El `switch (request.paymentMethod)` de 80 líneas.
2. Los tres `switch (this.currentStatus)` de `order.ts`, más las cadenas de `if`
   que validan las transiciones.
3. Las cinco llamadas seguidas a servicios distintos después de cobrar.
4. Las opciones `withLogging`, `withRetry` y `withCache`, y cómo se enredan
   dentro de `callGateway()`.
5. La traducción a mano de `LegacyPaymentRequest` en dos sitios distintos.
6. Los catorce parámetros posicionales de `createCheckoutRequest()`.
</details>

<details>
<summary>Pista 2 — el orden importa</summary>

No empieces por el más vistoso. Empieza por el que **más veces te haya hecho
volver al mismo archivo**. Si mañana entra Apple Pay, ¿qué tocas? Si mañana entra
el antifraude, ¿qué tocas? Ese es el orden de prioridad, no el catálogo de la
Gang of Four.
</details>

<details>
<summary>Pista 3 — la pregunta que desenmascara un patrón innecesario</summary>

*"¿Cuántos casos hay hoy y cuántos se esperan en los próximos seis meses?"*

Dos casos estables no justifican una jerarquía. Cuatro casos que crecen cada
trimestre, sí. El patrón no depende de lo feo que sea el código: depende de **por
dónde va a cambiar**.
</details>

---

## Reto extra

Cuando tengas tu `ANALISIS.md`, pásaselo a la IA con este encargo: *"hazme de
revisor crítico: ¿en cuál de estas decisiones me he pasado de ingeniería y en
cuál me he quedado corto?"*.

Después decide tú si tiene razón. Esa última decisión es tuya, y no se delega.
