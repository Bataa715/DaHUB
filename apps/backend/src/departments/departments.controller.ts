import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("departments")
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get("by-name/:name")
  findByName(@Param("name") name: string) {
    return this.departmentsService.findByName(decodeURIComponent(name));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.departmentsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.departmentsService.remove(id);
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  @Get(":id/photos")
  getPhotos(@Param("id") id: string) {
    return this.departmentsService.getPhotos(id);
  }

  @Get(":id/photos/:photoId/data")
  getPhotoData(@Param("photoId") photoId: string) {
    return this.departmentsService.getPhotoData(photoId);
  }

  @Post(":id/photos")
  async uploadPhoto(
    @Param("id") id: string,
    @Body()
    body: { imageData: string; caption?: string; departmentName?: string },
    @Request() req,
  ) {
    return this.departmentsService.uploadPhoto(
      id,
      body.departmentName ?? "",
      req.user.id,
      req.user.name ?? "",
      body.imageData,
      body.caption ?? "",
    );
  }

  @Delete(":id/photos/:photoId")
  deletePhoto(@Param("photoId") photoId: string) {
    return this.departmentsService.deletePhoto(photoId);
  }
}
