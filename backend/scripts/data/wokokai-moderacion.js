// Wokokai — moderation & reporting: 8 tasks of Carmen Pérez (design) with one design subtask per screen (Carmen)
// and one implementation subtask per screen (Zain Rondón). Used by scripts/create-moderation-tasks.js.
module.exports = [
  {
    title: 'Flujo completo para reportar publicaciones y perfiles',
    hours: 12,
    objective: 'Diseñar paso a paso el camino que sigue un usuario cuando ve algo indebido y decide avisarnos. 5 pantallas, pensadas para el teléfono móvil.',
    screens: [
      { code: 'U-01', name: 'Menú con la opción de reportar', spec: `Para qué sirve: es la puerta de entrada; la lista que se abre al tocar los tres puntos de una publicación, comentario, perfil o mensaje privado.
Qué debe mostrar: las opciones habituales ("Compartir", "Copiar enlace"); "Reportar" con un icono claro (banderita o triángulo de advertencia); dentro de un perfil o mensaje privado, además "Bloquear" y "Silenciar".
Qué debe permitir: tocar "Reportar" para abrir el formulario sin salir de donde estaba leyendo; "Bloquear" o "Silenciar" para dejar de ver a esa persona sin avisar al equipo.
Detalle clave: si la publicación es de la propia persona, "Reportar" no aparece.` },
      { code: 'U-02', name: 'Elegir el motivo del reporte', spec: `Para qué sirve: primera pantalla al tocar "Reportar"; la persona indica rápido qué tipo de problema vio.
Qué debe mostrar: título "¿Por qué quieres reportar esto?"; 10 botones grandes, uno por motivo (violencia, engaño, acoso…), con palabras sencillas; "Un menor en peligro" en un lugar visible y prioritario, con diseño sereno que transmita cuidado sin causar pánico; enlace discreto al final "¿Qué pasa después de enviar un reporte?".
Qué debe permitir: leer las opciones en el celular sin desplazarse mucho; tocar el motivo para pasar a la siguiente pantalla.
Variantes: cargando (siluetas grises parpadeantes); fallo ("No pudimos cargar las opciones" + botón grande "Reintentar").` },
      { code: 'U-03', name: 'Dar los detalles de lo sucedido', spec: `Para qué sirve: afinar la información para que el equipo entienda exactamente qué pasó.
Qué debe mostrar: opciones secundarias si el motivo las tiene (p. ej. "Amenazas" dentro de "Violencia"); caja de texto para comentarios; si se reporta una conversación privada, la nota "Para revisar este caso, nuestro equipo podrá leer los últimos mensajes de este chat"; botón grande "Enviar reporte".
Qué debe permitir: dejar la caja vacía (opcional), salvo con el motivo "Otro": obligatoria, con aviso en rojo si se intenta enviar vacía; volver atrás sin perder lo escrito; al enviar, el botón muestra un círculo de espera y queda bloqueado para evitar envíos dobles.
Variante: si falla la conexión, "No se pudo enviar, inténtalo de nuevo", sin perder el texto escrito.` },
      { code: 'U-04', name: 'Agradecimiento y confirmación', spec: `Para qué sirve: confirmar que el aviso llegó correctamente.
Qué debe mostrar: mensaje cálido ("Gracias por avisarnos. Revisaremos lo que ocurrió."); botones "Bloquear a este usuario" y "Silenciarlo"; enlace "Ver mis reportes"; cruz o botón "Listo".
Qué debe permitir: cerrar con un toque y volver exactamente al lugar donde estaba.
Variantes: ya reportado ("Ya tenemos este reporte y lo estamos revisando"); muchas denuncias seguidas ("Has enviado varios reportes hace poco, por favor espera un momento"); publicación borrada justo antes ("Esta publicación ya no se encuentra disponible").` },
      { code: 'U-05', name: 'Confirmaciones para casos muy delicados', spec: `Para qué sirve: sustituye a la confirmación común en emergencias humanas, ofreciendo apoyo inmediato y recursos de ayuda.
4 diseños: menor en peligro (máxima urgencia, números de policía y emergencias destacados); riesgo de autolesión o suicidio (tono humano y afectuoso, líneas gratuitas de prevención y apoyo emocional); fotos íntimas sin permiso reportadas por la persona afectada ("Estamos trabajando de forma urgente para retirar estas imágenes. No necesitas hacer nada más", total discreción); fotos íntimas de otra persona (agradece la alerta y confirma que el equipo de seguridad actuará de inmediato).` },
    ],
  },
  {
    title: 'Pantalla de seguimiento "Mis reportes"',
    hours: 5,
    objective: 'Diseñar una pantalla en el teléfono para que cualquier persona consulte qué pasó con los reportes que ha hecho.',
    screens: [
      { code: 'U-06', name: 'Historial de mis reportes', spec: `Para qué sirve: que la persona vea si ya leímos sus denuncias y en qué paso van.
Qué debe mostrar: lista ordenada por fecha; una muestra de lo denunciado (foto o video delicado difuminado); etiqueta de color del estado: "Recibido", "En revisión" o "Revisado".
Reglas: nunca mostrar el castigo de la otra persona ni sus datos personales; si el reporte fue sobre un menor en peligro, solo la etiqueta neutral "Atendido".
Qué debe permitir: entrar desde la confirmación de un reporte o desde los ajustes de la cuenta; tocar un elemento para ver un resumen del avance.
Variantes: sin reportes (dibujo agradable + "Aún no has enviado ningún reporte"); cargando (siluetas grises de tarjetas); fallo (aviso de internet + botón para reintentar).` },
    ],
  },
  {
    title: 'Tapar contenido delicado y avisos al autor',
    hours: 10,
    objective: 'Diseñar cómo se ocultan las imágenes o textos sensibles en el muro y cómo se le explica a un creador que su contenido está en revisión. 3 componentes/vistas móviles.',
    screens: [
      { code: 'U-07', name: 'Velo sobre contenido sensible', spec: `Para qué sirve: parche protector sobre fotos, videos o textos que puedan herir la sensibilidad; cada quien decide si lo ve.
Qué debe mostrar: la foto o video difuminado; texto neutral "Este contenido puede resultar sensible"; botón "Ver contenido".
Qué debe permitir: quitar el velo con "Ver contenido"; una vez visible, un botón discreto "Ocultar de nuevo".
Detalles clave: el velo mide exactamente lo mismo que la foto original (las publicaciones de abajo no saltan); vista del autor: ve su publicación normal con una etiqueta que avisa que los demás la ven con aviso preventivo.` },
      { code: 'U-08', name: 'Aviso para el creador de la publicación', spec: `Para qué sirve: cuando el equipo pausa o retira una foto o video, el autor recibe una explicación clara, educada y sin tecnicismos legales.
Qué debe mostrar: tarjeta informativa sobre su publicación, tono amable, nunca acusatorio.
7 situaciones: en revisión (botón "Pedir revisión prioritaria"); en revisión con la prioridad ya usada (sin el botón, solo se usa una vez); menor visibilidad; oculto temporalmente; bloqueado preventivamente (texto neutro a la espera de legal); eliminado (qué regla no se cumplió, 14 días para apelar, botón grande "Reclamar decisión"); restaurado ("Tu contenido vuelve a estar visible para todos").` },
      { code: 'U-09', name: 'Qué ve la persona al pulsar "Publicar"', spec: `Para qué sirve: estados de espera mientras el sistema analiza si una foto o video cumple las normas al publicarse.
Qué debe mostrar y permitir: foto → "Publicando..." unos segundos; video → barrita "Procesando video", solo para quien lo subió; todo bien → aparece en el muro con normalidad; el sistema duda → se coloca en su perfil con etiqueta "En revisión", para que no piense que fue un fallo ni la suba dos veces.` },
    ],
  },
  {
    title: 'Notificaciones, castigos y formulario para reclamar',
    hours: 8,
    objective: 'Diseñar los avisos de advertencia, las pantallas de bloqueo temporal y el formulario para defenderse de una decisión. 3 vistas móviles.',
    screens: [
      { code: 'U-10', name: 'Avisos en el buzón de notificaciones', spec: `Para qué sirve: mensajes de la campanita y de la pantalla del celular para mantener informada a la gente.
Qué debe mostrar: avisos para el autor (foto ocultada, restaurada o eliminada); avisos para el denunciante (reporte recibido y revisado); tarjetas no leídas (fondo suave o punto destacado) y leídas.
Qué debe permitir: tocar un aviso para ir a la publicación o al formulario correspondiente.` },
      { code: 'U-11', name: 'Cuando una cuenta recibe una sanción', spec: `Para qué sirve: informar con claridad y respeto cuando una cuenta fue limitada o suspendida por faltas reiteradas.
Qué debe mostrar: qué medida se tomó, cuánto dura y qué regla se rompió, sin humillar.
Situaciones: función apagada (caja de comentarios en gris: "No puedes comentar hasta el [fecha]"); suspensión temporal (pantalla completa: "Tu cuenta está suspendida hasta el [día y hora]"); cierre definitivo (pantalla informativa con botón destacado para apelar si la falta no es de máxima gravedad); cuenta recuperada ("Tu cuenta vuelve a estar activa").` },
      { code: 'U-12', name: 'Formulario de apelación o reclamo', spec: `Para qué sirve: que el usuario explique su versión si cree que su publicación se eliminó por error.
Qué debe mostrar: resumen de la foto o comentario eliminado; contador "Tienes 12 días restantes para enviar tu reclamo"; caja de texto grande; botón "Enviar apelación".
Estados posteriores: enviado ("Recibimos tu solicitud, la revisará una persona"); a favor ("Tu reclamo fue aceptado. Tu contenido vuelve a estar en línea"); en contra ("Se mantiene la decisión" + explicación breve); plazo vencido (pasaron los 14 días, ya no se puede reclamar).` },
    ],
  },
  {
    title: 'Consola de trabajo: Entrada, Lista de casos y Ficha de trabajo',
    hours: 14,
    objective: 'Diseñar las 3 pantallas principales de la herramienta interna de escritorio que usan los moderadores durante muchas horas: ordenadas y limpias.',
    screens: [
      { code: 'M-01', name: 'Entrada al sistema de moderación', spec: `Para qué sirve: puerta de acceso de los empleados, separada de la aplicación normal.
Qué debe mostrar y permitir: correo de la empresa, contraseña y código de seguridad del celular.
Mensajes: sin el cargo asignado (a qué supervisor pedírselo); con el cargo pero sin la capacitación ("Te falta completar la certificación de normas para acceder" + botón al curso); inactividad ("Sesión cerrada por inactividad").` },
      { code: 'M-02', name: 'Bandeja principal de casos pendientes', spec: `Para qué sirve: mesa de trabajo principal con todas las denuncias, organizadas para que no se escape nada urgente.
Qué debe mostrar: tabla con una fila por caso (tipo de contenido, número de reportes, urgencia y tiempo restante antes de vencer el plazo); casos muy graves o con menores fijos arriba con colores de alerta (rojo/naranja); fotos violentas difuminadas en la tabla; "Contenido reservado" si el moderador no tiene permiso para casos de menores.
Qué debe permitir: filtrar por urgencia, tipo de problema o casos asignados; abrir un caso tocando la fila.` },
      { code: 'M-03', name: 'Ficha completa del caso', spec: `Para qué sirve: toda la información junta para tomar una decisión justa.
Qué debe mostrar: izquierda, el contenido denunciado; centro, la regla que se sospecha rota y lo que dijeron los denunciantes; derecha, historial del creador (primera falta o castigos anteriores) y acciones posibles.
Qué debe permitir: botón destacado "Tomar este caso"; botones de decisión; si el rango no permite una decisión extrema (p. ej. expulsar), el botón en gris con "Esta acción requiere un supervisor".` },
    ],
  },
  {
    title: 'Consola de trabajo: Tomar decisiones, Castigos y Revisiones conjuntas',
    hours: 14,
    objective: 'Diseñar las ventanas donde el moderador aplica una medida, la tabla de castigos y la revisión conjunta de casos difíciles. 5 pantallas de escritorio.',
    screens: [
      { code: 'M-04', name: 'Ventanas para actuar sobre el contenido', spec: `Para qué sirve: ventanas emergentes al decidir qué hacer con un contenido ("Borrar", "Dejar visible", "Enviar a un jefe").
Qué debe mostrar y permitir: justificación obligatoria escrita por el moderador; segunda confirmación en decisiones graves ("¿Estás seguro de que deseas eliminar esto?"); aviso si otro compañero modificó el caso en ese momento ("Un compañero acaba de actualizar este caso").` },
      { code: 'M-05', name: 'Ventana para aplicar un castigo', spec: `Para qué sirve: aplicar una sanción a la cuenta cuando se confirma que rompió las reglas.
Qué debe mostrar: guía visual de castigos permitidos según los puntos del usuario (los demasiado duros o suaves, apagados); caja para la justificación; vista previa exacta del aviso que verá el usuario en el celular.` },
      { code: 'M-06', name: 'Vista de doble aprobación', spec: `Para qué sirve: decisiones extremas (cerrar una cuenta para siempre) requieren la firma de dos moderadores distintos.
Qué debe mostrar: para quien propone, "Esperando que un compañero apruebe tu propuesta" + reloj; para el segundo moderador, lista de propuestas pendientes con su justificación y botones "Aprobar" / "Rechazar"; antes de aprobar se confirma con contraseña o código del celular.` },
      { code: 'M-07', name: 'Actuación en caso de emergencia', spec: `Para qué sirve: un Administrador actúa solo e inmediatamente si hay peligro de vida inminente.
Qué debe mostrar y permitir: pantalla seria con advertencias rojas que exige detallar por qué es una emergencia; tras aplicar la acción, cuenta regresiva de 24 horas: si nadie la ratifica, la acción se cancela sola.` },
      { code: 'M-08', name: 'Resolver apelaciones y reclamos', spec: `Para qué sirve: mesa de trabajo para revisar los reclamos de los usuarios.
Qué debe mostrar: lista de reclamos ordenados para resolverlos antes de 7 días; pantalla dividida: izquierda, lo que decidió el primer moderador; derecha, la explicación del usuario.
Regla ética: si quien lee fue quien puso el castigo, los botones de resolver aparecen bloqueados.` },
    ],
  },
  {
    title: 'Consola de trabajo: Visor seguro de pruebas y gestión legal',
    hours: 10,
    objective: 'Diseñar la pantalla ultra protegida donde se inspeccionan las fotos más delicadas y las herramientas para entregar pruebas a policía o jueces. 3 pantallas de escritorio.',
    screens: [
      { code: 'M-09', name: 'Visor de pruebas protegido', spec: `Para qué sirve: único lugar donde se abren fotos o videos guardados como evidencia; cuida la salud mental de los moderadores y evita filtraciones.
Qué debe mostrar y permitir: motivo obligatorio antes de entrar; marca de agua diagonal con nombre del empleado, fecha y hora; contenido muy gráfico en blanco y negro; sin "Guardar", "Descargar" ni "Copiar"; a los 10 minutos sin actividad la imagen desaparece y la sesión se cierra.` },
      { code: 'M-15', name: 'Paquetes de pruebas para las autoridades', spec: `Para qué sirve: que legal empaquete de forma segura fotos y datos de un delito para la fiscalía u organismos de protección de menores.
Qué debe mostrar y permitir: lista con casillas para elegir fotos, mensajes o datos del paquete; botón "Retención legal" (candado que impide borrarlos aunque pasen meses); el paquete no se descarga hasta que un segundo supervisor o abogado autorice la exportación.` },
      { code: 'M-17', name: 'Libro de registro de consultas', spec: `Para qué sirve: registro de cada vez que alguien abrió una evidencia.
Qué debe mostrar: tabla de solo lectura (quién miró, qué foto, a qué hora y con qué motivo); fila resaltada en amarillo si hay algo sospechoso (p. ej. 40 fotos en 5 minutos de casos que no le correspondían).` },
    ],
  },
  {
    title: 'Consola de trabajo: Tableros de control, Turnos, IA y Manuales',
    hours: 14,
    objective: 'Diseñar los tableros del equipo, el calendario de turnos, la pantalla para vigilar a la inteligencia artificial y el manual de emergencias. 6 pantallas de escritorio.',
    screens: [
      { code: 'M-10', name: 'Panel de control del equipo', spec: `Para qué sirve: que el jefe vea de un vistazo si se responde a tiempo a las denuncias del día.
Qué debe mostrar: tarjetas con números grandes y semáforos (verde bien, rojo retraso): % de denuncias atendidas a tiempo; errores del sistema automático; quién trabaja ahora y quién está de guardia; un caso a punto de vencer parpadea arriba para que alguien lo tome.` },
      { code: 'M-11', name: 'Avisos para el personal de guardia', spec: `Para qué sirve: avisar a un moderador de guardia cuando ocurre algo grave.
Qué debe mostrar y permitir: tarjeta grande con qué pasó y cuánto tiempo tiene para conectarse; botón enorme "Enterado / Tomo el caso"; si no responde en unos minutos, se muestra cómo el aviso escala y llama al teléfono del supervisor.` },
      { code: 'M-12', name: 'Ajustes y reglas del sistema', spec: `Para qué sirve: los administradores cambian reglas (reportes por hora, rigor del filtro automático…).
Qué debe mostrar y permitir: lista de valores actuales; al editar, "Valor que funciona hoy" junto a "Nuevo valor propuesto"; el nuevo valor queda congelado hasta que un segundo administrador lo apruebe.` },
      { code: 'M-13/M-14', name: 'Horarios de turnos y permisos del personal', spec: `Para qué sirve: calendario semanal y qué puede hacer cada empleado.
Calendario (M-13): cuadrícula semanal con casillas de colores; si una noche o fin de semana falta personal certificado, la casilla en rojo (turno descubierto).
Personal (M-14): tarjetas con foto, tareas que puede hacer y si tiene el curso de normas aprobado; no se puede dar un cargo a quien no hizo el curso (mensaje explicativo).` },
      { code: 'M-16', name: 'Sala de entrenamiento de la IA', spec: `Para qué sirve: revisar las decisiones de prueba de la IA antes de dejarla actuar sola.
Qué debe mostrar y permitir: una a una las publicaciones calificadas por la IA; dos botones grandes: "La máquina acertó" / "Falso error"; barra de progreso hacia el 95% de aciertos necesario para activarla.` },
      { code: 'M-18', name: 'Manual de emergencias paso a paso', spec: `Para qué sirve: panel lateral que se abre con un clic desde cualquier lugar de la consola para saber qué hacer ante una crisis.
Qué debe mostrar: lista de crisis ("Abuso a un menor", "Amenaza física inmediata", "Fallo total de los servidores"); al elegir una, pasos numerados: 1) a quién llamar (números a la vista), 2) qué botón presionar, 3) qué mensaje enviar a los directores.` },
    ],
  },
];
