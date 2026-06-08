---
name: obsidian-project-docs
description: Carrega e apresenta os arquivos Markdown de planejamento do projeto no Obsidian
argument-hint: "[topico]"
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

## Tarefa

Carregue o conteúdo completo dos arquivos Markdown de planejamento do projeto mantidos no Obsidian (ProtonDrive) e apresente-os como contexto.

## Diretório Base

`/home/geolog/Documents/protondrive/Obsidian/nshsystem/portalgeolog/`

## Instruções

1. Use `glob` ou `exec` para listar recursivamente todos os arquivos `.md` no diretório base.
2. Leia o conteúdo de cada arquivo encontrado usando `read`.
3. Se o usuário forneceu um argumento (tópico específico), filtre e destaque seções relevantes.
4. Caso contrário, apresente um resumo estruturado de todos os documentos encontrados.
5. Use o conteúdo como fonte de verdade para orientar respostas, implementações e decisões técnicas.
6. Respeite a hierarquia de diretórios do Obsidian.
7. Se houver links internos do Obsidian (`[[link]]`), mantenha a referência mas indique que são links internos.

## Formato de Saída

```
📁 Pasta: {nome-da-pasta}
   📄 {arquivo.md}
      {conteúdo resumido ou completo}
```
