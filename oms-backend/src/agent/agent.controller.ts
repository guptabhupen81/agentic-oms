import { Body, Controller, Post } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * Single endpoint for conversational agent interaction. The client is
   * responsible for passing back `messages` from the previous response to
   * continue a conversation (stateless server, per-request context) — same
   * pattern Web and Mobile both follow, so there's no server-side session
   * state to keep in sync between platforms.
   */
  @Post('chat')
  chat(@Body() body: { message: string; history?: Anthropic.MessageParam[] }) {
    return this.agentService.chat(body.message, body.history ?? []);
  }
}
