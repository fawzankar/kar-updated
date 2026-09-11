# Fowzan's Inbox

A simple anonymous messaging website made by **Fowzan Kar**.

Basically, this is a place where people can send messages/questions anonymously, get replies, continue conversations through threads, and share them in a nicer way.

I made this project myself because I wanted to build something that actually looks good and feels nice to use instead of just making another basic anonymous-message website.

## What is it?

Fowzan's Inbox lets people:

- Send anonymous messages
- Receive questions and messages
- Reply to messages
- Continue conversations in threads
- View answered questions
- Share a thread through its link
- Turn a question/thread into a 9:16 story design
- Add a caption to a story before sharing it
- Use Gamer or Minimal mode
- Change colours/themes
- Use it on mobile or desktop

## The two looks

### Gamer

The Gamer version has a cyber / Matrix-inspired look with Matrix rain, particles, neon effects, dark backgrounds and different colour themes.

### Minimal

The Minimal version is cleaner and more elegant. It focuses more on typography, spacing and the actual messages instead of lots of effects.

## Anonymous Messages

The main idea is simple:

**Someone asks → you answer → people can see the conversation.**

Messages can be answered and continued through threads so the inbox can feel more like an actual conversation.

## Sharing

There are two different sharing options:

### Share thread

This shares the normal public thread link. It is useful when you want people to open the actual conversation and continue reading it.

### Share to Story

This creates a vertical 9:16 story card containing the question and, when available, the replies in the conversation. You can add your own caption before sharing it.

On supported phones and browsers, the generated image is handed to the device's native share sheet so apps such as Instagram and WhatsApp can receive the actual image. The exact destination is controlled by the operating system and the installed app — a normal website cannot force Instagram to open directly to Stories or force WhatsApp directly to Status.

The idea is basically similar to the way anonymous-message apps make a question look good when it is posted to a story: the content is turned into the visual instead of just posting a boring URL.

## Tech Used

- Next.js
- React
- TypeScript
- CSS
- Lucide Icons
- Browser APIs

The project is intentionally kept fairly simple so people can understand it, change it and build on it.

## Running It

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Can I Use This?

Yes.

This is an open-source project. You are free to:

- Use it
- Study it
- Modify it
- Improve it
- Add features
- Change the design
- Fork it
- Build your own version
- Experiment with it

If you make something cool with it, that's honestly great.

Just please don't remove the original author credit and then claim that you originally created the whole project yourself.

## Contributions

If you find a bug or have an idea, feel free to contribute.

Fork it, make your changes, test them and open a pull request.

If you think something can be done better, go ahead and improve it. That's basically the point of making it open source.

## Credits

### Created by Fowzan Kar

The original concept, design direction, implementation and features of **Fowzan's Inbox** were created by **Fowzan Kar**.

This project was made by me, and the original author credit should stay with the project when it is reused or modified.

## 10-B

Made as a project by **Fowzan Kar — 10-B**.

## A Note From Me

I didn't make this project with the intention of making some huge complicated piece of software.

I wanted to make something that looks good, works properly and is actually fun to use.

If you're looking through the code and think something can be done better, then go ahead and improve it.

If you find a bug, fix it.

If you have a feature idea, build it.

If you want to completely change the design, do it.

That's what open source is for.

Thanks for checking out the project.

**— Fowzan Kar**


## Story sharing

The private/admin inbox includes a Story sharing option for questions and answered threads. It creates a 9:16 image and uses the phone browser's native image-sharing sheet when supported. Instagram and WhatsApp decide which destinations they expose; a normal website cannot force a specific app's Story/Status composer.
