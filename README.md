## API Documentation

This project uses **OpenAPI (Swagger)** for API documentation.

### Tools

- **@nestjs/swagger**
- **Swagger UI**
- **OpenAPI Specification**

### Accessing the documentation

Once the application is running, the API documentation is available at: http://localhost:3000/documentation

### Accessing screenshot of swagger ui

![Swagger UI](./docs/swagger_ui.PNG)


-------------------------------------------------

## Mail Notification 

This project uses **MailHog** for the mail notification in local

## installation of mailhog (for each user)
if linux (in the terminal):
    -Download Mailhog:
    => wget https://github.com/mailhog/MailHog/releases/latest/download/MailHog_linux_amd64

    -Make the binary executable:
    chmod +x MailHog_linux_amd64

    -Move the binary(Optional but recommended):
    => sudo mv MailHog_linux_amd64 /usr/local/bin/mailhog


    -execute:
    => mailhog
        Web interface : http://localhost:8025

if windows :

    -Download mailhog on https://github.com/mailhog/MailHog/releases
    => MailHog_windows_amd64.exe

    -install and web interface available on http://localhost:8025


.env need these variables:
    MAIL_HOST=localhost
    MAIL_PORT=1025
    MAIL_SECURE=false
    MAIL_FROM="Dev <dev@test.com>"


## how to use
in the mail.controller.ts
    put the decorator @POST('') and call the function you wanna use , sendSimpleMail()/ sendWithAttachement()

    for exemple:

    @Post('send-simple')
    async sendSimple() {
        return this.mailService.sendSimpleMail(
        'test@test.com',               // destinataire
        'Test Email',                  // sujet
        '<h1>Bonjour !</h1><p>Ceci est un email de test.</p>' // contenu HTML
        );
    }

    then the terminal you launch the command :
    => curl -X POST http://localhost:3000/mail/send-simple
    