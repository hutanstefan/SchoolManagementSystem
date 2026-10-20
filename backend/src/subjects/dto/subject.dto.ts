import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/transformers';

export class CreateSubjectDto {
  /** @example Computer Science */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}

export class UpdateSubjectDto extends CreateSubjectDto {}

export class SubjectDto {
  id!: string;
  /** @example Mathematics */
  name!: string;
}
