# Deploy do AutoOS na nuvem do LARCC

Roteiro para subir a API (API + Postgres + Nginx) numa VM do LARCC. Base: o
"Manual do Usuário para Utilização da Nuvem Computacional do LARCC" e o e-mail
de liberação do ambiente.

## O que precisa ficar claro antes

- **Alocação temporária.** O ambiente foi liberado **até dezembro**, com
  manutenção programada depois do período letivo. Serve para a entrega do
  trabalho e para testes, **não** como casa definitiva do sistema. Quando
  terminar, **avise o LARCC** e apague VMs, imagens, templates e snapshots.
- **O disco da VM é local ao servidor e pode falhar.** Backup do banco é
  obrigatório e precisa sair da VM (seção "Backup").
- **A VM não tem IP público.** Ela fica na rede interna (`192.168.20.x`). Para
  o celular chegar na API é preciso pedir ao LARCC a liberação de portas no
  firewall (seção "Pedido ao LARCC").
- **Uso permitido:** estudo e pesquisa. Para qualquer uso além disso (a oficina
  usando de verdade), combine com os administradores.

## 1. Acesso por SSH

O acesso tem dois saltos: a **máquina de acesso** (`138.94.76.170`, porta
`2291`) e depois a VM pela rede interna. Use o `ProxyJump` para fazer os dois
de uma vez. Em `~/.ssh/config` (no Windows: `C:\Users\<voce>\.ssh\config`):

```
Host larcc-gw
  HostName 138.94.76.170
  Port 2291
  User SEU_USUARIO_DO_LARCC

Host larcc-vm
  HostName 192.168.20.X        # IP da VM, no Sunstone
  User root
  ProxyJump larcc-gw
```

Prefira **chave SSH** a senha (assim ninguém precisa digitar nem colar senha):

```powershell
ssh-keygen -t ed25519
# Windows não tem ssh-copy-id; instale a chave pública nos dois saltos:
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh larcc-gw "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh larcc-vm "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Na **primeira** entrada na VM, troque a senha padrão com `passwd` (o manual
exige, e a senha padrão está impressa no PDF).

## 2. Tamanho da VM

A template de exemplo do manual tem 1000 MB de RAM e 5 GB de disco: é pouco
para Docker + Postgres + build da API. Recomendado (estimativa, confirme com o
LARCC o que o cluster aguenta): **2048 MB de RAM, CPU = vCPU = 2, disco 20 GB**.
Para mudar, desligue a VM (`shutdown -h now`) e edite no Sunstone; cuide para o
disco não ficar em modo somente leitura.

## 3. Preparar a VM (uma vez)

O código precisa estar no GitHub (`git push` do que você quer subir). Entre na
VM e rode o bootstrap:

```bash
ssh larcc-vm
# Repositório PÚBLICO:
curl -fsSLO https://raw.githubusercontent.com/machadogustavors/autoos/main/deploy/larcc/bootstrap.sh
sudo bash bootstrap.sh          # Docker, git, firewall da VM e o código em /opt/autoos
```

Repositório **privado**: o `curl` acima não funciona. Copie o script do seu PC
(`scp deploy/larcc/bootstrap.sh larcc-vm:`) e rode com um token de leitura:
`sudo REPO_URL=https://<token>@github.com/machadogustavors/autoos bash bootstrap.sh`.
Apague o token da VM depois (`git -C /opt/autoos remote set-url origin https://github.com/machadogustavors/autoos`).

## 4. Subir o sistema

```bash
cd /opt/autoos
sudo GOOGLE_CLIENT_ID=<id do cliente Web> SEED_USER_EMAIL=<gmail> \
  SELF_SIGNED=1 CERT_HOST=<ip ou nome> bash deploy/larcc/deploy.sh
```

O script gera `JWT_SECRET` e a senha do Postgres (em `api/.env` e `.env`, modo
600), cria um certificado, sobe tudo, espera a API responder e cadastra o
usuário. **Guarde uma cópia do `api/.env` fora da VM**: sem ele, os tokens
emitidos deixam de valer e o banco restaurado não abre.

`SELF_SIGNED=1` cria um certificado **autoassinado de 30 dias, que o celular não
aceita**. Serve para ver a pilha subir. Para o app, use o certificado real:

### Certificado real

Precisa de um **nome de domínio** apontando para o IP por onde a VM é alcançada
e das portas 80/443 abertas até ela. Com isso, na VM, com o Nginx parado:

```bash
sudo apt-get install -y certbot
cd /opt/autoos && sudo docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d SEU.DOMINIO
sudo cp /etc/letsencrypt/live/SEU.DOMINIO/fullchain.pem deploy/certs/
sudo cp /etc/letsencrypt/live/SEU.DOMINIO/privkey.pem  deploy/certs/
sudo docker compose -f docker-compose.prod.yml up -d nginx
```

Renovação (a cada ~60 dias) precisa repetir isso; não está automatizada.
Sem domínio próprio, um nome gratuito (ex.: DuckDNS) apontando para o IP do
LARCC resolve.

### Quando só uma porta externa chega na VM (o caso real do LARCC)

O LARCC não abriu 80/443: o professor criou um redirecionamento em TCP puro
`138.94.76.170:8082` → porta 80 da VM. Por isso o `nginx.conf` termina TLS
**também na porta 80** (sem redirect para HTTP) e o app usa
`https://SEU.DOMINIO:8082/v1`. Como a 80 externa não está disponível, o
certificado sai por **desafio DNS** (não precisa de porta aberta), com
`acme.sh` e DuckDNS:

```bash
read -rs -p "Token DuckDNS: " DuckDNS_Token; export DuckDNS_Token; echo
curl -s https://get.acme.sh | sh -s email=SEU@EMAIL
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
~/.acme.sh/acme.sh --issue --dns dns_duckdns -d SEU.duckdns.org
~/.acme.sh/acme.sh --install-cert -d SEU.duckdns.org \
  --fullchain-file /opt/autoos/deploy/certs/fullchain.pem \
  --key-file /opt/autoos/deploy/certs/privkey.pem \
  --reloadcmd "docker compose -f /opt/autoos/docker-compose.prod.yml exec -T nginx nginx -s reload"
```

O `acme.sh` agenda a renovação sozinho (cron) e o token fica em
`~/.acme.sh/account.conf` (modo 600). Não cole o token em chat nem no git.

Atualizar o sistema depois: `cd /opt/autoos && sudo git pull && sudo bash deploy/larcc/deploy.sh`.

## 5. Pedido ao LARCC

O e-mail diz que dá para pedir acesso externo a serviços das VMs. Modelo:

> Olá! Subi o AutoOS (API HTTP/HTTPS) na VM `<nome>` (IP interno `192.168.20.X`).
> Poderiam liberar no firewall as portas **80/tcp e 443/tcp** do IP público
> 138.94.76.170 para essa VM? Se for possível também um nome de domínio ou
> subdomínio, melhor. Se for preciso um broker MQTT (porta 8883 ou WebSocket
> seguro), peço também. Aviso quando concluir o uso para a desalocação.

Pergunte também se existe um **broker MQTT** deles: os contratos
(`contract/mqtt-topics.md`) falam em "broker do LARCC", mas o manual não cita.
O app publica por `wss://`, então o broker precisa de WebSocket com TLS.

## 6. Apontar o app

O endereço da API entra no app **na hora do build** (`EXPO_PUBLIC_API_URL` em
`app/.env`), por exemplo `https://SEU.DOMINIO/v1`. Mudou o endereço, faz build
novo. Builds de loja só aceitam HTTPS; o dev client em debug aceita HTTP.

## 7. Backup

```bash
# Na VM: dump comprimido e verificado, guarda 14 dias em /var/backups/autoos
sudo bash /opt/autoos/deploy/larcc/backup.sh

# Diário às 3h:
echo '0 3 * * * root /opt/autoos/deploy/larcc/backup.sh >> /var/log/autoos-backup.log 2>&1' \
  | sudo tee /etc/cron.d/autoos-backup
```

**Isso ainda é backup dentro da mesma VM.** Traga os arquivos para outra
máquina (a sua, por exemplo), a cada poucos dias:

```powershell
scp -r larcc-vm:/var/backups/autoos E:\backups\autoos-larcc
```

Restaurar: `sudo bash deploy/larcc/restore.sh /var/backups/autoos/autoos-AAAAMMDD-HHMMSS.sql.gz`
(apaga o banco atual; pede confirmação). Teste a restauração uma vez antes de
precisar dela.

## 8. Ao terminar

1. Faça o último backup e traga para fora.
2. Avise os administradores do LARCC.
3. No Sunstone, apague as VMs, imagens, templates e snapshots do seu usuário
   (boa prática do manual).

## Estado de validação

- `deploy.sh`, `backup.sh` e `restore.sh` foram exercitados numa cópia limpa do
  repositório com Docker local.
- `bootstrap.sh` **não** foi executado numa VM Ubuntu real (usa `apt`); o nome
  do pacote do plugin `docker compose` varia por versão do Ubuntu e o script
  tenta as alternativas conhecidas. Leia a saída na primeira execução.
- Nada foi testado dentro do LARCC: o roteiro de rede e firewall depende do que
  os administradores liberarem.
