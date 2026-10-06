-- Solo para desarrollo local y CI. En producción los roles y passwords
-- se crean fuera del repositorio.
CREATE ROLE clubsystem_owner LOGIN PASSWORD 'owner';
CREATE ROLE clubsystem_app LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS;

CREATE DATABASE clubsystem OWNER clubsystem_owner;
CREATE DATABASE clubsystem_test OWNER clubsystem_owner;

GRANT CONNECT ON DATABASE clubsystem, clubsystem_test TO clubsystem_app;
