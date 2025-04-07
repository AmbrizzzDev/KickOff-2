// Bloquear clic derecho
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// Bloquear teclas como F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
document.addEventListener("keydown", (e) => {
  if (
    e.key === "F12" ||
    (e.ctrlKey &&
      e.shiftKey &&
      (e.key === "I" || e.key === "C" || e.key === "J")) ||
    (e.ctrlKey && e.key === "U")
  ) {
    e.preventDefault();
  }
});

// Bloquear selección de texto
document.addEventListener("selectstart", (e) => {
  e.preventDefault();
});

// Bloquear arrastrar elementos
document.addEventListener("dragstart", (e) => {
  e.preventDefault();
});
