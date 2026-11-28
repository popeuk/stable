// La jumelle de préprod de la fonction « tiroirs » : même serveur, tables
// « _preprod » (0004_tiroirs_preprod.sql) et site de préprod.
import { PREPROD, servir } from "../tiroirs/serveur.ts";

servir(PREPROD);
