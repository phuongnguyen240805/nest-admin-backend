require('dotenv').config()
const { Client } = require('pg')

function createPgClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
}

const CORE_TABLES = [
  'sys_organizations', 'sys_dept', 'sys_role', 'sys_menu', 'sys_dict_type', 'sys_config',
  'sys_task', 'sys_user', 'sys_dict_item', 'sys_user_roles', 'sys_role_menus',
  'sys_login_log', 'sys_captcha_log', 'sys_task_log', 'todo', 'tool_storage',
  'user_access_tokens', 'user_refresh_tokens', 'sys_subscription', 'sys_credit_wallet',
  'sys_agent', 'tenants', 'tenant_users',
]

module.exports = { createPgClient, CORE_TABLES }