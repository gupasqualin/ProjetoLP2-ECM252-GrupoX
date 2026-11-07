# ---------- Estagio 1: compilacao ----------
FROM dart:stable AS build

WORKDIR /app

COPY pubspec.yaml pubspec.lock ./
RUN dart pub get

COPY . .
RUN dart compile exe bin/server.dart -o bin/server

# ---------- Estagio 2: execucao ----------
# Imagem minima: so o executavel compilado e as bibliotecas de runtime do Dart.
FROM scratch

COPY --from=build /runtime/ /
COPY --from=build /app/bin/server /app/bin/server

EXPOSE 3001

CMD ["/app/bin/server"]
