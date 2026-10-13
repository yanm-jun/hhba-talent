import os
from alembic import context
from sqlalchemy import engine_from_config, pool
config=context.config
if os.getenv('DATABASE_URL'):
 config.set_main_option('sqlalchemy.url',os.environ['DATABASE_URL'])
def run_migrations_offline():
 context.configure(url=config.get_main_option('sqlalchemy.url'),literal_binds=True)
 with context.begin_transaction(): context.run_migrations()
def run_migrations_online():
 e=engine_from_config(config.get_section(config.config_ini_section),prefix='sqlalchemy.',poolclass=pool.NullPool)
 with e.connect() as c:
  context.configure(connection=c)
  with context.begin_transaction(): context.run_migrations()
if context.is_offline_mode():run_migrations_offline()
else:run_migrations_online()
