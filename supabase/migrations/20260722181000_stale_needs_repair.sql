-- Проданий пристрій не може потребувати ремонту: прапорець лишився від
-- старої моделі й засмічує сегмент «Потребує уваги» на Техніці.
update devices set needs_repair = false where needs_repair and status = 'sold';
