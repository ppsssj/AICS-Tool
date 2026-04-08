const REPOSITORY_DRIVER = process.env.LAB_REPOSITORY_DRIVER ?? 'file';
const repositoryModule =
  REPOSITORY_DRIVER === 'prisma'
    ? await import('./prisma-lab-repository.mjs')
    : await import('./file-lab-repository.mjs');

export const labRepository =
  REPOSITORY_DRIVER === 'prisma'
    ? repositoryModule.prismaLabRepository
    : repositoryModule.fileLabRepository;

export function getRepositoryDriver() {
  return REPOSITORY_DRIVER;
}
