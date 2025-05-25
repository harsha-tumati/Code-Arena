import argparse
import importlib.util
import time
import csv
import random

GRID_SIZE = 30
PADDLE_WIDTH = 2
MAX_SCORE = 5

class Paddle:
    def __init__(self, y):
        self.y = y
        self.x = GRID_SIZE // 2 - 1

    def move(self, direction):
        if direction == "left" and self.x > 0:
            self.x -= 1
        elif direction == "right" and self.x + PADDLE_WIDTH < GRID_SIZE:
            self.x += 1

    def in_range(self, ball_x):
        return self.x <= ball_x < self.x + PADDLE_WIDTH

class Ball:
    def __init__(self):
        self.x = random.randint(0, GRID_SIZE - 1)
        self.y = GRID_SIZE // 2
        self.dx = random.choice([-1, 1])
        self.dy = random.choice([-1, 1])

    def move(self):
        self.x += self.dx
        self.y += self.dy
        if self.x <= 0 or self.x >= GRID_SIZE - 1:
            self.dx *= -1  # Bounce off side walls

class PlayerWrapper:
    def __init__(self, path):
        self.path = path
        spec = importlib.util.spec_from_file_location("bot", path)
        print(spec, "---------")
        self.bot = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.bot)

    def get_move(self, game_state):
        return self.bot.next_move(game_state)

def get_game_state(ball, paddle1, paddle2, player):
    return {
        "ball": {"x": ball.x, "y": ball.y, "dx": ball.dx, "dy": ball.dy},
        "you": {"x": paddle1.x, "y": paddle1.y},
        "opponent": {"x": paddle2.x, "y": paddle2.y},
        "player": player
    }

def play_game(bot1_path, bot2_path, logfile):
    bot1 = PlayerWrapper(bot1_path)
    bot2 = PlayerWrapper(bot2_path)

    scores = {"bot1": 0, "bot2": 0}
    round_num = 0

    # Open CSV log file
    with open(logfile, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["step", "ball_x", "ball_y", "paddle1_x", "paddle2_x", "bot1_action", "bot2_action", "score_bot1", "score_bot2"])

        step = 0

        while scores["bot1"] < MAX_SCORE and scores["bot2"] < MAX_SCORE:
            round_num += 1
            ball = Ball()
            paddle1 = Paddle(GRID_SIZE - 1)
            paddle2 = Paddle(0)

            while True:
                state1 = get_game_state(ball, paddle1, paddle2, "bot1")
                move1 = bot1.get_move(state1)
                paddle1.move(move1)

                state2 = get_game_state(ball, paddle2, paddle1, "bot2")
                move2 = bot2.get_move(state2)
                paddle2.move(move2)

                ball.move()

                step += 1
                writer.writerow([
                    step,
                    ball.x,
                    ball.y,
                    paddle1.x,
                    paddle2.x,
                    move1,
                    move2,
                    scores["bot1"],
                    scores["bot2"]
                ])

                if ball.y <= 0:
                    if not paddle2.in_range(ball.x):
                        scores["bot1"] += 1
                        print(f"Point to bot1! Score: {scores}")
                        break
                    else:
                        ball.dy *= -1
                elif ball.y >= GRID_SIZE - 1:
                    if not paddle1.in_range(ball.x):
                        scores["bot2"] += 1
                        print(f"Point to bot2! Score: {scores}")
                        break
                    else:
                        ball.dy *= -1

                time.sleep(0.05)  # Optional: slow for visualization

    print(f"Final Score: {scores}")
    print("Winner:", "bot1" if scores["bot1"] > scores["bot2"] else "bot2")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--p1", required=True, help="Path to bot1.py")
    parser.add_argument("--p2", required=True, help="Path to bot2.py")
    parser.add_argument('--logfile')
    args = parser.parse_args()

    play_game(args.p1, args.p2, args.logfile)
