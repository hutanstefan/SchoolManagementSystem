import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { LocalFileStorage, type OpenFailure } from './local-storage';
import { contentDisposition, FILE_STORAGE, type FileStorage } from './storage';

const MESSAGES: Record<OpenFailure, string> = {
  invalid: 'This link is invalid',
  expired: 'This link has expired: open the file again from the app',
  missing: 'This file is no longer in the storage',
};

/** The error as a small page, for a browser tab or the app's preview frame. */
function errorPage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>File not available</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;background:#f6f6f4;color:#2c2c2a}
@media (prefers-color-scheme:dark){body{background:#17171a;color:#e8e8e6}}main{max-width:26rem;padding:2rem;text-align:center}h1{font-size:1.1rem;margin:0 0 .5rem}p{margin:0;opacity:.75}</style></head>
<body><main><h1>File not available</h1><p>${message}.</p></main></body></html>`;
}

@ApiTags('Files')
@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: 'Open a file through a signed link',
    description:
      'Only with the local storage: the links given by e.g. GET /lectures/:id/link point here. The token names the file and expires after FILE_LINK_SECONDS, so no login is needed (it works in a new tab or an iframe). With S3 storage the links go straight to the bucket. Errors are a small HTML page for browsers, JSON otherwise.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Invalid or expired link, or the file is gone',
  })
  async open(
    @Param('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | string> {
    const opened =
      this.storage instanceof LocalFileStorage
        ? await this.storage.open(token)
        : 'invalid';
    // The app shows previews in an iframe of its own pages: allow framing by
    // the same origin only (and no other limits, which would stop the
    // browser's PDF viewer).
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    if (typeof opened === 'string') {
      if (opened === 'missing' && this.storage instanceof LocalFileStorage) {
        this.logger.warn(
          `A signed link points to a file that is not in ${this.storage.root}`,
        );
      }
      const message = MESSAGES[opened];
      if (req.accepts(['json', 'html']) === 'html') {
        res.status(HttpStatus.NOT_FOUND).type('html');
        res.setHeader('Cache-Control', 'no-store');
        return errorPage(message);
      }
      throw new NotFoundException(message);
    }

    res.setHeader('Cache-Control', 'private, max-age=60');
    return new StreamableFile(opened.stream, {
      type: opened.contentType,
      length: opened.size,
      disposition: contentDisposition(opened.disposition, opened.fileName),
    });
  }
}
