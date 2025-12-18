import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, validateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, organizationId: string, createDto: CreateCommentDto) {
    // Validate that at least one resource is specified
    if (!validateCommentDto(createDto)) {
      throw new BadRequestException('Either credentialId or invoiceId must be provided');
    }

    // Verify resource exists and belongs to organization
    if (createDto.credentialId) {
      const credential = await this.prisma.credential.findFirst({
        where: {
          id: createDto.credentialId,
          organizationId, // Multi-tenant isolation
        },
      });
      if (!credential) {
        throw new NotFoundException('Credential not found');
      }
    }

    if (createDto.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          id: createDto.invoiceId,
          organizationId, // Multi-tenant isolation
        },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
    }

    return this.prisma.comment.create({
      data: {
        content: createDto.content,
        userId,
        credentialId: createDto.credentialId,
        invoiceId: createDto.invoiceId,
        parentId: createDto.parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(organizationId: string, credentialId?: string, invoiceId?: string) {
    const where: any = {
      parentId: null, // Top-level comments only
    };

    if (credentialId) {
      // Verify credential belongs to organization
      const credential = await this.prisma.credential.findFirst({
        where: { id: credentialId, organizationId },
      });
      if (!credential) {
        throw new NotFoundException('Credential not found');
      }
      where.credentialId = credentialId;
    }

    if (invoiceId) {
      // Verify invoice belongs to organization
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      where.invoiceId = invoiceId;
    }

    return this.prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
