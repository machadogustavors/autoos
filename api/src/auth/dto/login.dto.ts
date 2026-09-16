import { IsNotEmpty, IsString } from 'class-validator';

// RF-01 — idToken do Google (Google Identity Services), não a string "dev".
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
