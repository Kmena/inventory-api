const fs = require('fs/promises');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const prisma = require('../src/lib/prisma');
const {
  buildProtectedClientDocumentUrl,
  buildPrivateClientDocumentPath,
  buildLegacyPublicClientDocumentPath,
  isLegacyPublicClientDocumentUrl,
} = require('../src/lib/client-document-storage');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function moveFileToPrivateStorage(sourcePath, destinationPath) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await fs.rename(sourcePath, destinationPath);
    return;
  } catch (error) {
    if (error.code !== 'EXDEV') {
      throw error;
    }
  }

  await fs.copyFile(sourcePath, destinationPath);
  await fs.unlink(sourcePath);
}

async function migrateClientDocuments() {
  const documents = await prisma.clientDocument.findMany({
    where: {
      fileUrl: {
        startsWith: '/uploads/client-documents/',
      },
    },
    include: {
      client: {
        select: {
          companyId: true,
        },
      },
    },
    orderBy: [{ clientId: 'asc' }, { id: 'asc' }],
  });

  let migratedCount = 0;
  let updatedReferenceCount = 0;
  let missingFileCount = 0;

  for (const document of documents) {
    if (!document.client?.companyId) {
      console.warn(`[client-document-migration] Documento ${document.id} omitido: cliente sin companyId.`);
      continue;
    }

    const targetFileUrl = buildProtectedClientDocumentUrl(document.clientId, document.id);
    const destinationPath = buildPrivateClientDocumentPath({
      companyId: document.client.companyId,
      clientId: document.clientId,
      documentId: document.id,
      fileName: document.fileName,
    });
    const sourcePath = isLegacyPublicClientDocumentUrl(document.fileUrl)
      ? buildLegacyPublicClientDocumentPath(document.fileUrl)
      : null;

    const destinationExists = await pathExists(destinationPath);
    const sourceExists = sourcePath ? await pathExists(sourcePath) : false;

    if (sourceExists && !destinationExists) {
      await moveFileToPrivateStorage(sourcePath, destinationPath);
      migratedCount += 1;
    } else if (sourceExists && destinationExists) {
      await fs.unlink(sourcePath);
      migratedCount += 1;
    } else if (!sourceExists && !destinationExists) {
      console.warn(`[client-document-migration] Documento ${document.id} sin archivo legible en origen ni destino.`);
      missingFileCount += 1;
      continue;
    }

    if (document.fileUrl !== targetFileUrl) {
      await prisma.clientDocument.update({
        where: { id: document.id },
        data: { fileUrl: targetFileUrl },
      });
      updatedReferenceCount += 1;
    }
  }

  console.log(JSON.stringify({
    migratedCount,
    updatedReferenceCount,
    missingFileCount,
    scannedCount: documents.length,
  }));
}

migrateClientDocuments()
  .catch((error) => {
    console.error('[client-document-migration] Error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
