import { Link } from '@tanstack/react-router';
import { App as StickerBookApp } from '../games/sticker-book/App';
import '../games/sticker-book/styles.css';

export function StickerBookPage() {
  return (
    <main className="game-route game-route--sticker-book">
      <nav className="game-chrome" data-game-chrome aria-label="Game navigation">
        <Link className="game-back" to="/">
          Games
        </Link>
        <span>Sticker Book</span>
      </nav>

      <StickerBookApp />
    </main>
  );
}
