# Summary
The objective is to create a website called pokerbanker. This is a simple website that would keep track of buy ins for small house games to make settling up at the end of the session easier. This would only track and do math, all actual payment would be done elsewhere. This website is intended for personal use, so efficiency/optimization are not necessary.

# Background
Usually, cash games operate where one person volunteers as the banker for the table. Everyone buys in for some amount (say $20), mentally records the buy in, and takes that amount of chips. At the end of the session, every person counts their stack and pays the banker $(buy ins) - $(chip stack).

This puts a lot of work and responsibility on the one banker. This one person has an excess of bank transactions and assumes the risk if someone lies about a stack size (uncommon) or miscounts (somewhat common). Additionally, this setup itself is inefficient with respect to the number of transactions, time, etc.

# Inputs/Outputs
Inputs: Users/players will input and track their buy ins (in dollars), as well as putting their stack in at the end. Players can optionally add their own payment information in a text field (for a Venmo handle or Zelle phone number)

Outputs: The program would output a list of transactions to be made in order to settle everyone up. For example, player A pays player B $5.30, player C pays player B $20.50, player D pays player E $13.00. The program should also flag if the number of chips counted at the end is inconsistent with the total buy ins.

# Optimization/Objective
There are infinite ways to settle up the table. The program should use an algorithm to optimize the following parameters, in the following order of strict priority:
- 1: Minimize the total number of transactions
- 2: Spread out transactions among more people, if solutions with equal numbers of transactions exist
- 3: Minimize the size of the largest transaction
Note that this is not a complete list of possible optimizations. Add other optimizations if they have some potential subjective benefit when it comes to solving the core problem.

# Implementation Details
The program will run as a website hosted on GitHub pages. Each player will navigate to the website independently, join/create a room (noted with a 2 character alphanumeric code like A5, not case sensitive), and individually enter their information (name, buy-in amount, stack amount (initially empty), and payment information) and see others' information.

With respect to the user interface, there should be options for text input as well as button increment. For buy ins, the button increments should be +- $5, $10, and $20. For stack size, button increments should be +- 10¢, 50¢, $1, $5, $10. The exact layout is to be determined.

Room information should persist but auto delete itself after 24hrs.

There will exist an option to calculate the settle up for the entire table. Additionally, there should be options for when a single player leaves/cashes and whom they should pay/receive from. There should be an option for one player to buy in from another player, which happens in cases where the total number of available chips is small, so one person takes, for example $10, in chips from another player. The taker's buy in increases by $10 and the other's decreases by $10.

There should be a (minimizable) console/log showing all actions by everyone ("X" joined the room, bought in for $Y, changed "Z"s stack size, etc.)

The visual appearance/theme should be minimal. Simple shapes and colors with form following and not going beyond function. Assume this website will primarily be accessed on mobile.

# Other
This description is not comprehensive and only covers the general outline/vision of the software. Use best practices for algorithm creation, UI/UX design, and addition of new features and modification of existing features.