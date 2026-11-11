# Solo leemos tiendas cuyo robots.txt lo permite o que firmaron un feed

Créditos Económicos, Almacenes Japón, Orve Hogar y Marcimex prohíben en su robots.txt toda URL con parámetros (`Disallow: /*?`). Eso incluye la búsqueda de su catálogo. No las leemos aunque técnicamente se pueda. Cada corrida comprueba el robots.txt antes de empezar y, si la ruta está prohibida, marca la tienda como `sin_permiso` y no hace ninguna otra petición. Las tiendas pueden entrar por un feed acordado, como hacen con idealo. Ese es el camino previsto para crecer y para un modelo de coste por salida.
