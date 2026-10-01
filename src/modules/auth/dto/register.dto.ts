import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '@modules/auth/users/dto/create-user.dto';

/** Public self-registration — unlike admin-created users, the role is never caller-supplied. */
export class RegisterDto extends OmitType(CreateUserDto, ['roleId'] as const) {}
