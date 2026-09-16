import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// RF-03 — cadastro rápido, dentro do fluxo de nova OS.
export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
