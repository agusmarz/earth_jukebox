// Atajos de teclado. Todo lo que se puede hacer con la voz
// también se puede hacer con el teclado.

export function conectarTeclado(app) {
  window.addEventListener('keydown', (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const tecla = evento.key;
    const enBoton = evento.target instanceof HTMLButtonElement;

    if (app.estado === 'inicio') {
      evento.preventDefault();
      app.empezar();
      return;
    }

    if (tecla === ' ') {
      evento.preventDefault();
      if (!evento.repeat) app.pulsarParaHablar();
      return;
    }

    // Enter sobre un botón hace lo que dice el botón
    if (tecla === 'Enter' && enBoton) return;

    const acciones = {
      ArrowRight: () => app.moverFoco(1),
      ArrowDown: () => app.moverFoco(1),
      ArrowLeft: () => app.moverFoco(-1),
      ArrowUp: () => app.moverFoco(-1),
      Enter: () => app.elegirEnfocado(),
      Escape: () => app.volver(),
      p: () => app.alternarPausa(),
      r: () => app.repetir(),
      d: () => app.describir(),
      h: () => app.ayuda(),
      v: () => app.alternarVoz(),
    };

    const accion = acciones[tecla] ?? acciones[tecla.toLowerCase()];
    if (accion) {
      evento.preventDefault();
      accion();
      return;
    }

    if (/^[1-9]$/.test(tecla)) {
      evento.preventDefault();
      app.elegirNumero(Number(tecla));
    }
  });
}
