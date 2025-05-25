import random

def next_move(state):
    # 10% chance of random wrong action
    if random.random() < 0.1:
        return random.choice(["left", "right", "stay"])
    else:
        ball_x = state["ball"]["x"]
        my_x = state["you"]["x"]

        # Default correct action
        if ball_x < my_x:
            action = "left"
        elif ball_x > my_x + 1:
            action = "right"
        else:
            action = "stay"
        return action