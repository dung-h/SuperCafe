FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    git \
    ssmtp \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install pdo pdo_mysql

# Cấu hình SSMTP để gửi mail qua MailHog
RUN echo "mailhub=mailhog:1025" > /etc/ssmtp/ssmtp.conf && \
    echo "FromLineOverride=YES" >> /etc/ssmtp/ssmtp.conf

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/conf-available/*.conf

WORKDIR /var/www/html

COPY . /var/www/html

# Install PHP dependencies with Composer
RUN composer install --no-interaction --no-dev