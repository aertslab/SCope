import { RootState } from '../../redux/reducers';

import { State } from './model';
import { NAME } from './constants';

export const active = (state: RootState): State => state[NAME];
