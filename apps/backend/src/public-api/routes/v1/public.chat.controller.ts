import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PublicChatMessageDto } from '@gitroom/backend/public-api/dtos/public.chat.dto';
import { PublicChatService } from '@gitroom/backend/public-api/services/public.chat.service';

@ApiTags('Public API')
@Controller('/public/v1/chat')
export class PublicChatController {
  constructor(private _chatService: PublicChatService) {}

  @Post('/messages')
  sendMessage(
    @GetOrgFromRequest() organization: Organization,
    @Body() body: PublicChatMessageDto
  ) {
    return this._chatService.sendMessage(
      organization,
      body.message,
      body.threadId
    );
  }

  @Get('/threads/:threadId')
  getThread(
    @GetOrgFromRequest() organization: Organization,
    @Param('threadId') threadId: string
  ) {
    return this._chatService.getThread(organization.id, threadId);
  }
}
