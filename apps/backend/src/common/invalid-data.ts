import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';

export const INVALID_DATA_MESSAGE = 'Données invalides.';

/**
 * 400 générique (design.md §11 Property 1) : jamais le nom d'un champ inconnu
 * ni le détail interne ; au plus la liste des champs déclarés du DTO en erreur.
 */
export class InvalidDataException extends BadRequestException {
  constructor(fields: string[] = []) {
    super({
      statusCode: 400,
      error: 'Bad Request',
      message: INVALID_DATA_MESSAGE,
      ...(fields.length > 0 ? { fields } : {}),
    });
  }
}

/** 400 métier volontaire, dont le message (en français) est destiné à l'utilisateur. */
export class BusinessRuleException extends BadRequestException {}

// Les erreurs « whitelistValidation » portent sur des champs non déclarés : jamais exposées
function invalidFields(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const constraints = Object.keys(error.constraints ?? {});
    const own = constraints.some((c) => c !== 'whitelistValidation') ? [path] : [];
    return [...own, ...invalidFields(error.children ?? [], path)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new InvalidDataException(invalidFields(errors)),
  });
}

/**
 * Tout autre 400 (JSON mal formé, ParseUUIDPipe, etc.) porte un message
 * technique du framework : il est remplacé par la réponse générique.
 */
@Catch(BadRequestException)
export class BadRequestFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const safe =
      exception instanceof InvalidDataException || exception instanceof BusinessRuleException
        ? exception
        : new InvalidDataException();
    response.status(400).json(safe.getResponse());
  }
}
