-- Solo para desarrollo local y CI. En producción los roles y passwords
-- se crean fuera del repositorio.
-- El dueño ejecuta migraciones, seeds y scripts administrativos: no está sujeto a RLS.
CREATE ROLE clubsystem_owner LOGIN PASSWORD 'owner' BYPASSRLS;
CREATE ROLE clubsystem_app LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS;

CREATE DATABASE clubsystem OWNER clubsystem_owner;
CREATE DATABASE clubsystem_test OWNER clubsystem_owner;

GRANT CONNECT ON DATABASE clubsystem, clubsystem_test TO clubsystem_app;
