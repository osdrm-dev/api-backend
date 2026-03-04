import { PartialType } from '@nestjs/mapped-types';
import { CreatePVDto } from './create-pv.dto';

export class UpdatePVDto extends PartialType(CreatePVDto) {}
