---
name: reversa-schema-sync
description: Sincroniza o schema.sql do projeto com a estrutura atual do banco MySQL. Gera o script de reinstalação (CREATE TABLE + seed INSERTS) a partir do banco de dados ativo.
trigger: /reversa-schema-sync
color: emerald
---

# reversa-schema-sync

Atualiza `schema.sql` na raiz do projeto para refletir a estrutura atual do banco MySQL, permitindo reinstalação limpa do zero.

## Como ativar
- Digite `/reversa-schema-sync`
- Ou digite `reversa-schema-sync`

## Pré-requisitos
- Servidor rodando (MySQL conectado)
- Credenciais no `.env` ou nos defaults em `server/db.ts`

## O que o agente faz

### Fase 1 — Extrair estrutura do MySQL
1. Conecta ao banco `imob` usando as credenciais do projeto
2. Executa `SHOW TABLES` para listar todas as tabelas
3. Para cada tabela, executa `SHOW CREATE TABLE` e extrai o DDL
4. Preserva a ordem: corretores → corretor_specialties → properties → property_features → demands → demand_neighborhoods → matches → match_history → favorites → notifications → ratings

### Fase 2 — Regenerar schema.sql
1. Lê o `schema.sql` existente (se houver)
2. Substitui o bloco de CREATE TABLE mantendo:
   - Cabeçalho e comentários iniciais
   - `CREATE DATABASE IF NOT EXISTS imob`
   - Bloco `DROP TABLE IF EXISTS` (com `SET FOREIGN_KEY_CHECKS = 0/1`)
   - Estrutura atualizada de cada tabela
3. Preserva os seed INSERTS existentes (a menos que seedData=true)
4. Salva em `C:\edinho\imobil\schema.sql`

### Fase 3 (opcional) — Seed data
Se solicitado com `--seed` ou `seedData=true`, extrai os dados atuais do banco e gera INSERTs completos com todos os registros.

## Regras
- NUNCA modifique arquivos fora de `schema.sql`
- NUNCA quebre a compatibilidade com versões anteriores do schema
- Sempre use `IF NOT EXISTS` em CREATE TABLE
- Sempre use `SET FOREIGN_KEY_CHECKS = 0/1` no bloco de DROP
- Engine: `InnoDB`, charset: `utf8mb4`, collation: `utf8mb4_unicode_ci`
