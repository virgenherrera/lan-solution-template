import { Injectable } from '@nestjs/common';
import { isSea } from 'node:sea';
import { derivePaths, resolveBase, type AppPaths } from './paths.js';

// Injected by class. Every process resolves its own paths, and a child is the same executable as the supervisor, so both get the same base and open the same database.
@Injectable()
export class AppPathsService {
  readonly paths: AppPaths = derivePaths(resolveBase({ sea: isSea(), execPath: process.execPath, cwd: process.cwd() }));
}
