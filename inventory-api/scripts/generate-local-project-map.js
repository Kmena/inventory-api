const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "docs", "graphify-out");

const approvedDocs = [
  "ERD_v1.md",
  "erDiagram.mmd",
  "erd_mvp_1.mmd",
  "er_mvp_prd.md",
  "er_propuesto_prd.md",
  "prd_actualizacion_catalogo_precios.md",
  "Proyecto Inventario Interno - Prd V1.pdf",
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function fileNodeId(relativePath) {
  return `file:${toPosix(relativePath)}`;
}

function addNode(graph, node) {
  if (!graph.nodeMap.has(node.id)) {
    graph.nodeMap.set(node.id, node);
  }
}

function addEdge(graph, source, target, relation) {
  const id = `${source}::${relation}::${target}`;
  if (!graph.edgeMap.has(id)) {
    graph.edgeMap.set(id, { source, target, relation });
  }
}

function extractRequires(content) {
  const matches = [];
  const requireRegex = /require\((["'])(.+?)\1\)/g;
  let match;
  while ((match = requireRegex.exec(content))) {
    matches.push(match[2]);
  }
  return matches;
}

function extractPrismaModels(schemaText) {
  const modelRegex = /^model\s+(\w+)\s+\{/gm;
  const models = [];
  let match;
  while ((match = modelRegex.exec(schemaText))) {
    models.push(match[1]);
  }
  return models;
}

function extractPrismaEnums(schemaText) {
  const enumRegex = /^enum\s+(\w+)\s+\{/gm;
  const enums = [];
  let match;
  while ((match = enumRegex.exec(schemaText))) {
    enums.push(match[1]);
  }
  return enums;
}

function summarizeDoc(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const relativePath = path.relative(projectRoot, filePath);

  if (ext === ".pdf") {
    return {
      id: fileNodeId(relativePath),
      label: path.basename(filePath),
      type: "document",
      subtype: "pdf",
      relativePath: toPosix(relativePath),
      sizeBytes: stat.size,
      summary: "Documento PDF aprobado para el mapa local.",
    };
  }

  const content = readText(filePath);
  const headings = content
    .split(/\r?\n/)
    .filter((line) => /^(#|##|###)\s+/.test(line))
    .slice(0, 8)
    .map((line) => line.replace(/^#+\s+/, "").trim());

  return {
    id: fileNodeId(relativePath),
    label: path.basename(filePath),
    type: "document",
    subtype: ext.replace(".", "") || "text",
    relativePath: toPosix(relativePath),
    sizeBytes: stat.size,
    headings,
    summary:
      headings.length > 0
        ? `Documento con ${headings.length} encabezados principales detectados.`
        : "Documento sin encabezados Markdown detectados en el analisis local.",
  };
}

function buildGraph() {
  const graph = {
    nodeMap: new Map(),
    edgeMap: new Map(),
  };

  const packageJson = readJson(path.join(projectRoot, "package.json"));
  const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");
  const schemaText = readText(schemaPath);
  const sourceFiles = walkFiles(path.join(projectRoot, "src")).filter((filePath) =>
    [".js", ".html", ".css"].includes(path.extname(filePath).toLowerCase()),
  );
  const prismaFiles = walkFiles(path.join(projectRoot, "prisma")).filter((filePath) =>
    [".prisma", ".js", ".md", ".sql", ".toml"].includes(path.extname(filePath).toLowerCase()),
  );
  const docFiles = approvedDocs
    .map((name) => path.join(projectRoot, "docs", name))
    .filter((filePath) => fs.existsSync(filePath));

  addNode(graph, {
    id: "project:inventory-api",
    label: packageJson.name,
    type: "project",
    version: packageJson.version,
    entrypoint: packageJson.main,
  });

  addNode(graph, {
    id: "runtime:node",
    label: "Node.js / Express API",
    type: "runtime",
  });
  addEdge(graph, "project:inventory-api", "runtime:node", "runs_on");

  for (const [scriptName, command] of Object.entries(packageJson.scripts || {})) {
    const id = `script:${scriptName}`;
    addNode(graph, {
      id,
      label: scriptName,
      type: "script",
      command,
    });
    addEdge(graph, "project:inventory-api", id, "has_script");
  }

  for (const [dependencyName, version] of Object.entries(packageJson.dependencies || {})) {
    const id = `dependency:${dependencyName}`;
    addNode(graph, {
      id,
      label: dependencyName,
      type: "dependency",
      version,
      scope: "runtime",
    });
    addEdge(graph, "project:inventory-api", id, "depends_on");
  }

  for (const [dependencyName, version] of Object.entries(packageJson.devDependencies || {})) {
    const id = `dependency:${dependencyName}`;
    addNode(graph, {
      id,
      label: dependencyName,
      type: "dependency",
      version,
      scope: "development",
    });
    addEdge(graph, "project:inventory-api", id, "depends_on");
  }

  const fileGroups = [
    { key: "src", files: sourceFiles },
    { key: "prisma", files: prismaFiles },
    { key: "docs", files: docFiles },
  ];

  for (const group of fileGroups) {
    const groupId = `group:${group.key}`;
    addNode(graph, {
      id: groupId,
      label: group.key,
      type: "group",
    });
    addEdge(graph, "project:inventory-api", groupId, "contains");
  }

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    const normalizedRelative = toPosix(relativePath);
    const nodeId = fileNodeId(relativePath);
    const content = readText(filePath);
    const layer = normalizedRelative.split("/")[1] || "root";

    addNode(graph, {
      id: nodeId,
      label: path.basename(filePath),
      type: "file",
      layer,
      relativePath: normalizedRelative,
      extension: path.extname(filePath).toLowerCase(),
    });
    addEdge(graph, "group:src", nodeId, "contains");

    for (const requiredPath of extractRequires(content)) {
      if (!requiredPath.startsWith(".")) continue;
      const resolvedPath = path.resolve(path.dirname(filePath), requiredPath);
      const candidates = [
        resolvedPath,
        `${resolvedPath}.js`,
        `${resolvedPath}.json`,
        path.join(resolvedPath, "index.js"),
      ];
      const existing = candidates.find((candidate) => fs.existsSync(candidate));
      if (!existing) continue;
      const targetRelative = path.relative(projectRoot, existing);
      addEdge(graph, nodeId, fileNodeId(targetRelative), "imports");
    }
  }

  for (const filePath of prismaFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    const nodeId = fileNodeId(relativePath);
    addNode(graph, {
      id: nodeId,
      label: path.basename(filePath),
      type: "file",
      layer: "prisma",
      relativePath: toPosix(relativePath),
      extension: path.extname(filePath).toLowerCase(),
    });
    addEdge(graph, "group:prisma", nodeId, "contains");
  }

  const prismaModels = extractPrismaModels(schemaText);
  const prismaEnums = extractPrismaEnums(schemaText);
  for (const modelName of prismaModels) {
    const id = `model:${modelName}`;
    addNode(graph, {
      id,
      label: modelName,
      type: "prisma_model",
    });
    addEdge(graph, fileNodeId(path.join("prisma", "schema.prisma")), id, "declares");
  }
  for (const enumName of prismaEnums) {
    const id = `enum:${enumName}`;
    addNode(graph, {
      id,
      label: enumName,
      type: "prisma_enum",
    });
    addEdge(graph, fileNodeId(path.join("prisma", "schema.prisma")), id, "declares");
  }

  const basenameIndex = new Map();
  for (const filePath of sourceFiles) {
    basenameIndex.set(path.basename(filePath, ".js"), filePath);
  }

  for (const filePath of sourceFiles.filter((value) => value.endsWith(".routes.js"))) {
    const stem = path.basename(filePath).replace(".routes.js", "");
    const routeId = fileNodeId(path.relative(projectRoot, filePath));
    const servicePath = basenameIndex.get(`${stem}.service`);
    const schemaPathMatch = basenameIndex.get(`${stem}.schema`);
    if (servicePath) {
      addEdge(graph, routeId, fileNodeId(path.relative(projectRoot, servicePath)), "routes_to");
    }
    if (schemaPathMatch) {
      addEdge(graph, routeId, fileNodeId(path.relative(projectRoot, schemaPathMatch)), "validates_with");
    }
  }

  for (const filePath of sourceFiles.filter((value) => value.endsWith(".service.js"))) {
    const stem = path.basename(filePath).replace(".service.js", "");
    const serviceId = fileNodeId(path.relative(projectRoot, filePath));
    const repositoryPath = basenameIndex.get(`${stem}.repository`);
    const schemaPathMatch = basenameIndex.get(`${stem}.schema`);
    if (repositoryPath) {
      addEdge(graph, serviceId, fileNodeId(path.relative(projectRoot, repositoryPath)), "uses_repository");
    }
    if (schemaPathMatch) {
      addEdge(graph, serviceId, fileNodeId(path.relative(projectRoot, schemaPathMatch)), "uses_schema");
    }
  }

  for (const docPath of docFiles) {
    const docNode = summarizeDoc(docPath);
    addNode(graph, docNode);
    addEdge(graph, "group:docs", docNode.id, "contains");
  }

  return {
    generatedAt: new Date().toISOString(),
    generator: "scripts/generate-local-project-map.js",
    mode: "local-only",
    projectRoot,
    nodes: Array.from(graph.nodeMap.values()).sort((a, b) => a.id.localeCompare(b.id)),
    edges: Array.from(graph.edgeMap.values()).sort((a, b) => {
      const aKey = `${a.source}:${a.relation}:${a.target}`;
      const bKey = `${b.source}:${b.relation}:${b.target}`;
      return aKey.localeCompare(bKey);
    }),
    stats: {
      sourceFiles: sourceFiles.length,
      prismaFiles: prismaFiles.length,
      approvedDocs: docFiles.length,
      prismaModels: prismaModels.length,
      prismaEnums: prismaEnums.length,
      scripts: Object.keys(packageJson.scripts || {}).length,
      dependencies:
        Object.keys(packageJson.dependencies || {}).length +
        Object.keys(packageJson.devDependencies || {}).length,
    },
  };
}

function buildReport(graph) {
  const routes = graph.nodes.filter((node) => node.type === "file" && /\.routes\.js$/.test(node.relativePath || ""));
  const services = graph.nodes.filter((node) => node.type === "file" && /\.service\.js$/.test(node.relativePath || ""));
  const repositories = graph.nodes.filter((node) => node.type === "file" && /\.repository\.js$/.test(node.relativePath || ""));
  const schemas = graph.nodes.filter((node) => node.type === "file" && /\.schema\.js$/.test(node.relativePath || ""));
  const documents = graph.nodes.filter((node) => node.type === "document");
  const keyDocs = documents.map((node) => `- ${node.relativePath}`).join("\n");

  return `# Local Project Graph

Generado localmente el ${graph.generatedAt}.

## Resumen

- Modo: \`${graph.mode}\`
- Source files: ${graph.stats.sourceFiles}
- Prisma files: ${graph.stats.prismaFiles}
- PRD/ERD incluidos: ${graph.stats.approvedDocs}
- Modelos Prisma: ${graph.stats.prismaModels}
- Enums Prisma: ${graph.stats.prismaEnums}
- Scripts npm: ${graph.stats.scripts}
- Dependencias detectadas: ${graph.stats.dependencies}

## Arquitectura detectada

- Entry point principal: \`src/server.js\`
- Aplicacion HTTP: \`src/app.js\`
- Capas backend:
  - rutas: ${routes.length}
  - servicios: ${services.length}
  - repositorios: ${repositories.length}
  - esquemas: ${schemas.length}
- Persistencia: \`prisma/schema.prisma\` + migraciones versionadas
- Frontend demo local: \`src/public/\`

## Documentos incluidos

${keyDocs}

## Salidas

- \`local-graph.json\`: nodos y relaciones estructurales
- \`GRAPH_REPORT.md\`: este resumen
- \`graph.html\`: visor local basico
`;
}

function buildHtml(graph) {
  const payload = JSON.stringify(graph).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Local Project Graph</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffaf2;
      --ink: #1f2933;
      --muted: #52606d;
      --line: #d9cbb3;
    }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: linear-gradient(180deg, #f7f2e9 0%, #efe3cf 100%);
      color: var(--ink);
    }
    header, main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(41, 30, 17, 0.06);
    }
    h1, h2, h3, h4 {
      margin-top: 0;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      font: inherit;
    }
    ul {
      padding-left: 18px;
    }
    li {
      margin: 6px 0;
    }
    button {
      font: inherit;
    }
    .muted {
      color: var(--muted);
    }
    .pill {
      display: inline-block;
      margin: 4px 6px 0 0;
      padding: 4px 10px;
      border-radius: 999px;
      background: #f2e0d0;
      color: #6d3a1a;
      font-size: 13px;
    }
    .edge {
      border-top: 1px solid var(--line);
      padding: 10px 0;
    }
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Local Project Graph</h1>
    <p class="muted">Mapa estructural local del proyecto, sin dependencias externas.</p>
  </header>
  <main class="grid">
    <section class="card">
      <h2>Resumen</h2>
      <div id="stats"></div>
      <h2>Buscar nodo</h2>
      <input id="search" placeholder="Ej. order.service, Product, ERD_v1" />
      <div id="results"></div>
    </section>
    <section class="card">
      <h2>Relaciones</h2>
      <div id="details" class="muted">Selecciona un nodo para ver sus relaciones.</div>
    </section>
  </main>
  <script>
    const graph = ${payload};
    const stats = document.getElementById("stats");
    const search = document.getElementById("search");
    const results = document.getElementById("results");
    const details = document.getElementById("details");

    stats.innerHTML = [
      ["Nodos", graph.nodes.length],
      ["Relaciones", graph.edges.length],
      ["Source files", graph.stats.sourceFiles],
      ["Modelos Prisma", graph.stats.prismaModels],
      ["Docs aprobados", graph.stats.approvedDocs]
    ].map(([label, value]) => "<div class='pill'>" + label + ": " + value + "</div>").join("");

    function renderResults(query) {
      const normalized = query.trim().toLowerCase();
      const found = graph.nodes
        .filter((node) => !normalized || node.id.toLowerCase().includes(normalized) || (node.label || "").toLowerCase().includes(normalized) || (node.relativePath || "").toLowerCase().includes(normalized))
        .slice(0, 25);

      results.innerHTML = "<ul>" + found.map((node) =>
        "<li><button data-node='" + node.id.replace(/'/g, "&apos;") + "'>" + (node.label || node.id) + "</button><div class='muted'>" + (node.relativePath || node.type) + "</div></li>"
      ).join("") + "</ul>";

      for (const button of results.querySelectorAll("button")) {
        button.addEventListener("click", () => renderNode(button.getAttribute("data-node")));
      }
    }

    function renderNode(nodeId) {
      const node = graph.nodes.find((item) => item.id === nodeId);
      const outgoing = graph.edges.filter((edge) => edge.source === nodeId);
      const incoming = graph.edges.filter((edge) => edge.target === nodeId);
      if (!node) return;

      details.innerHTML = [
        "<h3>" + (node.label || node.id) + "</h3>",
        "<div class='muted'>" + (node.relativePath || node.type) + "</div>",
        "<h4>Salientes</h4>",
        outgoing.length ? outgoing.map((edge) => "<div class='edge'><strong>" + edge.relation + "</strong> ? " + edge.target + "</div>").join("") : "<div class='muted'>Sin relaciones salientes.</div>",
        "<h4>Entrantes</h4>",
        incoming.length ? incoming.map((edge) => "<div class='edge'>" + edge.source + " ? <strong>" + edge.relation + "</strong></div>").join("") : "<div class='muted'>Sin relaciones entrantes.</div>"
      ].join("");
    }

    search.addEventListener("input", (event) => renderResults(event.target.value));
    renderResults("");
  </script>
</body>
</html>`;
}

function writeOutputs(graph) {
  ensureDir(outputDir);
  fs.writeFileSync(
    path.join(outputDir, "local-graph.json"),
    JSON.stringify(graph, null, 2),
    "utf8",
  );
  fs.writeFileSync(path.join(outputDir, "GRAPH_REPORT.md"), buildReport(graph), "utf8");
  fs.writeFileSync(path.join(outputDir, "graph.html"), buildHtml(graph), "utf8");
}

function main() {
  const graph = buildGraph();
  writeOutputs(graph);
  console.log(`Local project graph written to ${outputDir}`);
}

main();
