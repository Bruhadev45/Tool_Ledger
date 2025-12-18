import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
