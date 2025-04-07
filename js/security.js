// Block right click
document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

// Block keys like F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
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

// Block text selection
document.addEventListener("selectstart", (e) => {
  e.preventDefault();
});

// Block drag elements
document.addEventListener("dragstart", (e) => {
  e.preventDefault();
});
