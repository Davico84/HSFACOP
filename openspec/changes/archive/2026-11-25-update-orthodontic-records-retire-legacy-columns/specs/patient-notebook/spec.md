## REMOVED Requirements

### Requirement: Copia de las historias existentes a la libreta
**Reason**: La ventana de copia se cerró (`LEGACY_COPY_DEADLINE`), la acción administrativa borró los datos antiguos del servidor y las columnas se retiran del esquema: ya no hay datos que copiar ni endpoint que los sirva. La marca de respaldo que ponía esta copia se retira con ella.
**Migration**: Ninguna para el tratante: la libreta local, su exportación cifrada, la importación y la búsqueda local siguen como están. Lo que se copió quedó en cada libreta y en los archivos exportados por cada tratante.
