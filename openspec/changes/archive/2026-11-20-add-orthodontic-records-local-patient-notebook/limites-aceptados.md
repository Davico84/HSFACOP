# Límites aceptados de la libreta local

Fecha: 2026-11-19 · Responsable: David Velarde Alvarado (al ordenar aplicar este change).

Se acepta, tal como lo describen `proposal.md` y `design.md`:

1. **Un dispositivo.** La libreta vive en el navegador de cada dispositivo; pasarla a otro es manual, con el archivo cifrado.
2. **Sin cifrado en reposo.** Los datos están en claro dentro del navegador; se recomienda cifrar el disco del equipo. Quien use el mismo perfil del navegador puede leerlos hasta que se borren.
3. **Sin recuperación sin archivo.** Si el navegador borra la libreta (por ejemplo, Safari tras 7 días sin uso) y no hay un archivo exportado, no hay copia.
4. **Frase de 6 palabras (unos 66 bits) con PBKDF2-SHA256.** Resiste con medios razonables, pero PBKDF2 no resiste en memoria; la frase se muestra una sola vez.
5. **Fuga residual en la búsqueda.** La búsqueda local pide al servidor la lista de identificadores de las coincidencias: el servidor aprende qué historias se consultaron, aunque no el texto.
6. **Un frontend o una extensión comprometidos** pueden leer la libreta; no está cubierto.
7. **Revisión legal descartada** por el responsable (tarea 0.4): los datos guardados en el dispositivo siguen siendo datos personales de salud.
