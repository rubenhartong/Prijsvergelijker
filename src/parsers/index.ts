import { action } from './action';
import { ah } from './ah';
import { amazon } from './amazon';
import { bol } from './bol';
import { etos } from './etos';
import { hema } from './hema';
import { jumbo } from './jumbo';
import { kruidvat } from './kruidvat';
import { picnic } from './picnic';
import { plus } from './plus';
import type { Parser } from './types';

/** Eén parser-module per winkel. */
export const PARSERS: Record<string, Parser> = { picnic, ah, jumbo, plus, kruidvat, etos, action, hema, bol, amazon };
