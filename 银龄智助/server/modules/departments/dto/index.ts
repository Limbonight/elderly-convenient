import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class ListDepartmentsRequestDto {
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateDepartmentRequestDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
